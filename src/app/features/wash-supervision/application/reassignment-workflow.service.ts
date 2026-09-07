import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, Observable, takeUntil, timer } from 'rxjs';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ApplicationError } from '../../../core/api/application-error';
import { REASSIGNMENT_GATEWAY } from '../domain/ports/reassignment.gateway';
import {
  canReassign,
  PendingReassignment,
  ReassignmentCandidate,
  ReassignmentCommand,
} from '../domain/models/reassignment';
import { DurableOperation, SupervisorEntryLookup } from '../domain/models/supervisor-entry';
interface PendingAction {
  command: ReassignmentCommand;
  appointmentId: string;
  enrollment: string;
  operationId?: string;
  pollPath?: string;
  result?: DurableOperation;
}
const rejectionMessages: Record<string, string> = {
  VERSION_CONFLICT: 'La atención cambió. Consulta de nuevo y selecciona un espacio.',
  WASH_EXECUTION_NOT_PENDING_REASSIGNMENT:
    'Esta atención ya no está pendiente. Actualiza la lista.',
  TANK_CAPACITY_EXHAUSTED: 'Alguien ocupó ese lugar. Consulta los espacios disponibles.',
  RESOURCE_NOT_AVAILABLE: 'Ese espacio dejó de estar disponible. Selecciona otra opción.',
  INVALID_RESOURCE_COMBINATION:
    'La combinación de cabina y tina cambió. Consulta las opciones de nuevo.',
  CAPACITY_ALTERNATIVE_AVAILABLE:
    'Ya hay una alternativa disponible. Consulta los espacios para continuar.',
  ACTOR_NOT_AUTHORIZED: 'Tu cuenta no tiene permiso para realizar esta acción.',
  APPOINTMENT_CONTEXT_UNAVAILABLE: 'No se pudo verificar la cita. Intenta consultar más tarde.',
  RESOURCE_CONFIGURATION_UNAVAILABLE: 'No se pudo verificar la configuración de los espacios.',
};
@Injectable({ providedIn: 'root' })
export class ReassignmentWorkflowService {
  private readonly api = inject(REASSIGNMENT_GATEWAY);
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly tracker = inject(OperationTrackerService);
  private readonly receipts = signal<Record<string, PendingAction>>(this.restore());
  private epoch = 0;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly completed = signal<SupervisorEntryLookup | null>(null);
  readonly pending = computed(
    () => this.receipts()[this.session.session()?.accountId ?? ''] ?? null,
  );
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.epoch++;
      this.busy.set(false);
      this.error.set(null);
      this.completed.set(null);
    });
  }
  private restore(): Record<string, PendingAction> {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.reassignment.receipts.v1') ?? '{}');
    } catch {
      return {};
    }
  }
  private save(value: PendingAction | null): boolean {
    const owner = this.session.session()?.accountId;
    if (!owner) return false;
    const values = { ...this.receipts() };
    if (value) values[owner] = value;
    else delete values[owner];
    try {
      sessionStorage.setItem('estoma.reassignment.receipts.v1', JSON.stringify(values));
    } catch {
      // Keep already accepted receipts in memory even if the browser loses storage access.
      if (this.pending()) this.receipts.set(values);
      this.error.set(
        'No pudimos guardar el seguimiento en este navegador. Habilita el almacenamiento antes de continuar.',
      );
      return false;
    }
    this.receipts.set(values);
    return true;
  }
  start(row: PendingReassignment, choice: ReassignmentCandidate | null, reason = ''): void {
    if (
      this.busy() ||
      this.pending() ||
      !canReassign(row) ||
      (!choice && (!reason.trim() || reason.trim().length > 500))
    )
      return;
    const body: ReassignmentCommand['body'] = choice
      ? { expectedVersion: row.executionVersion, cabinId: choice.cabinId, tankId: choice.tankId }
      : {
          expectedVersion: row.executionVersion,
          cancellationSubreason: 'CAPACITY_LOSS',
          cancellationReason: reason.trim(),
        };
    this.completed.set(null);
    this.error.set(null);
    if (
      this.save({
        command: {
          washExecutionId: row.washExecutionId,
          idempotencyKey: crypto.randomUUID(),
          body,
        },
        appointmentId: row.appointment!.appointmentId,
        enrollment: row.student!.enrollment!,
      })
    )
      void this.resume();
  }
  reset(): void {
    if (!this.pending() && !this.busy()) {
      this.completed.set(null);
      this.error.set(null);
    }
  }
  private read<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(takeUntil(this.lifecycle.ended$)));
  }
  async resume(): Promise<void> {
    let pending = this.pending();
    if (!pending || this.busy()) return;
    const epoch = this.epoch;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!pending.operationId) {
        const receipt = await this.read(this.api.submit(pending.command));
        if (epoch !== this.epoch) return;
        pending = { ...pending, operationId: receipt.operationId, pollPath: receipt.pollPath };
        this.save(pending);
      }
      if (!pending.result || pending.result.status === 'PENDING') {
        const operationId = pending.operationId!;
        // Only the terminal result completes the wait; PENDING must never enable another command.
        const result = await this.read(
          this.tracker
            .trackWith(() => this.api.operation(operationId), { maxPendingPolls: 45 })
            .pipe(filter((operation) => operation.status !== 'PENDING')),
        );
        if (epoch !== this.epoch) return;
        pending = { ...pending, result };
        this.save(pending);
      }
      if (pending.result!.status === 'REJECTED') {
        const message =
          rejectionMessages[pending.result!.errorCode ?? ''] ??
          'No se pudo realizar la acción. Consulta el estado actualizado antes de continuar.';
        this.save(null);
        this.error.set(message);
        return;
      }
      if (pending.result!.status !== 'SUCCEEDED') {
        this.error.set(
          'El resultado aún no es concluyente. Conservamos la referencia; solicita apoyo antes de realizar otra acción.',
        );
        return;
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        const lookup = await this.read(this.api.lookup(pending.enrollment));
        if (epoch !== this.epoch) return;
        const execution = lookup.washExecution;
        const body = pending.command.body;
        const correctIdentity =
          lookup.appointment.appointmentId === pending.appointmentId &&
          execution?.washExecutionId === pending.command.washExecutionId &&
          execution.executionVersion > body.expectedVersion;
        const correctResult =
          'cabinId' in body
            ? execution?.status === 'IN_PROGRESS' &&
              lookup.activeResourceAssignment?.cabin.resourceId === body.cabinId &&
              lookup.activeResourceAssignment?.tank.resourceId === body.tankId
            : lookup.appointment.appointmentStatus === 'CANCELLED' &&
              execution?.status === 'CANCELLED';
        if (correctIdentity && correctResult) {
          this.save(null);
          this.completed.set(lookup);
          return;
        }
        await this.read(timer(1500));
      }
      this.error.set(
        'La acción terminó, pero los datos todavía se están actualizando. Consulta el resultado sin repetir la solicitud.',
      );
    } catch (error: unknown) {
      if (epoch !== this.epoch) return;
      if (
        !pending.operationId &&
        error instanceof ApplicationError &&
        [400, 403, 422].includes(error.status ?? 0)
      ) {
        this.save(null);
        this.error.set(
          'No se pudo enviar la solicitud. Verifica tu acceso y consulta los datos de nuevo.',
        );
      } else
        this.error.set(
          'No pudimos comprobar el resultado. Vuelve a consultar; conservamos la misma solicitud para evitar duplicados.',
        );
    } finally {
      if (epoch === this.epoch) this.busy.set(false);
    }
  }
}
