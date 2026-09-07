import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, Observable, take, switchMap, takeUntil, timer } from 'rxjs';
import {
  SUPERVISOR_EXIT_GATEWAY,
  CompleteExitCommand,
  SupervisorExecutionDetail,
  canCompleteExit,
} from '../domain/supervisor-exit';
import { validMaterials, ExitMaterials } from '../domain/student-exit';
import { SupervisorEntryLookup } from '../../wash-supervision/domain/models/supervisor-entry';
import { DurableOperation } from '../../wash-appointments/domain/models/appointment-registration';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ApplicationError } from '../../../core/api/application-error';
interface Receipt {
  command: CompleteExitCommand;
  appointmentId: string;
  studentName: string;
  operationId?: string;
  pollPath?: string;
  result?: DurableOperation;
}
@Injectable({ providedIn: 'root' })
export class SupervisorExitService {
  private readonly api = inject(SUPERVISOR_EXIT_GATEWAY);
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly tracker = inject(OperationTrackerService);
  private readonly receipts = signal<Record<string, Receipt>>(this.restore());
  private epoch = 0;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly settled = signal<SupervisorExecutionDetail | null>(null);
  readonly pending = computed(
    () => this.receipts()[this.session.session()?.accountId ?? ''] ?? null,
  );
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.epoch++;
      this.busy.set(false);
      this.error.set(null);
      this.settled.set(null);
    });
  }
  private restore(): Record<string, Receipt> {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.supervisor-exit.receipts.v1') ?? '{}');
    } catch {
      return {};
    }
  }
  private save(receipt: Receipt | null): boolean {
    const owner = this.session.session()?.accountId;
    if (!owner) return false;
    const next = { ...this.receipts() };
    if (receipt) next[owner] = receipt;
    else delete next[owner];
    try {
      sessionStorage.setItem('estoma.supervisor-exit.receipts.v1', JSON.stringify(next));
    } catch {
      if (this.pending()) this.receipts.set(next);
      this.error.set(
        'No pudimos guardar el seguimiento. Habilita el almacenamiento del navegador antes de enviar.',
      );
      return false;
    }
    this.receipts.set(next);
    return true;
  }
  start(lookup: SupervisorEntryLookup, finalMaterials: ExitMaterials): void {
    if (
      this.pending() ||
      this.busy() ||
      !canCompleteExit(lookup) ||
      !validMaterials(finalMaterials)
    )
      return;
    this.error.set(null);
    this.settled.set(null);
    if (
      this.save({
        appointmentId: lookup.appointment.appointmentId,
        studentName: lookup.student.displayName,
        command: {
          washExecutionId: lookup.washExecution!.washExecutionId,
          expectedVersion: lookup.washExecution!.executionVersion,
          finalMaterials: structuredClone(finalMaterials),
          idempotencyKey: crypto.randomUUID(),
        },
      })
    )
      void this.resume();
  }
  reset(): void {
    if (!this.busy() && !this.pending()) {
      this.error.set(null);
      this.settled.set(null);
    }
  }
  private read<T>(source: Observable<T>) {
    return firstValueFrom(source.pipe(takeUntil(this.lifecycle.ended$)));
  }
  async resume(): Promise<void> {
    let receipt = this.pending();
    if (!receipt || this.busy()) return;
    const epoch = this.epoch;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!receipt.operationId) {
        const accepted = await this.read(this.api.complete(receipt.command));
        if (epoch !== this.epoch) return;
        receipt = { ...receipt, operationId: accepted.operationId, pollPath: accepted.pollPath };
        this.save(receipt);
      }
      if (!receipt.result) {
        const id = receipt.operationId!;
        const result = await this.read(
          this.tracker
            .trackWith(
              () =>
                timer(0, 1000).pipe(
                  filter(() => document.visibilityState !== 'hidden'),
                  take(1),
                  switchMap(() => this.api.operation(id)),
                ),
              { intervalMs: 1500, maxPendingPolls: 35 },
            )
            .pipe(filter((r) => r.status !== 'PENDING')),
        );
        if (epoch !== this.epoch) return;
        receipt = { ...receipt, result };
        this.save(receipt);
      }
      if (receipt.result!.status === 'REJECTED') {
        const code = receipt.result!.errorCode;
        this.save(null);
        this.error.set(
          code === 'VERSION_CONFLICT' || code === 'INVALID_WASH_EXECUTION_STATUS'
            ? 'La atención cambió. Consulta de nuevo y revisa las cantidades antes de confirmar.'
            : 'No se pudo autorizar la salida. Consulta el estado actualizado antes de continuar.',
        );
        return;
      }
      if (receipt.result!.status !== 'SUCCEEDED') {
        this.error.set(
          'El resultado no es concluyente. Conservamos la referencia; solicita apoyo antes de realizar otra acción.',
        );
        return;
      }
      for (let attempt = 0; attempt < 15; attempt++) {
        const detail = await this.read(this.api.detail(receipt.command.washExecutionId));
        if (epoch !== this.epoch) return;
        const execution = detail.washExecution;
        if (
          detail.appointment.appointmentId === receipt.appointmentId &&
          execution.washExecutionId === receipt.command.washExecutionId &&
          execution.executionVersion > receipt.command.expectedVersion &&
          execution.status === 'COMPLETED' &&
          detail.appointment.appointmentStatus === 'COMPLETED' &&
          execution.activeResourceAssignment === null &&
          !!execution.lastResourceAssignment &&
          !!execution.completedAt &&
          validMaterials(execution.finalExitMaterials) &&
          Object.entries(receipt.command.finalMaterials).every(
            ([key, value]) => execution.finalExitMaterials![key as keyof ExitMaterials] === value,
          )
        ) {
          if (this.save(null)) this.settled.set(detail);
          return;
        }
        await this.read(timer(2000));
      }
      this.error.set(
        'La autorización se aplicó y los datos siguen actualizándose. Consulta el resultado sin repetir la acción.',
      );
    } catch (error: unknown) {
      if (epoch !== this.epoch) return;
      if (
        !receipt.operationId &&
        error instanceof ApplicationError &&
        [400, 403, 422].includes(error.status ?? 0)
      ) {
        this.save(null);
        this.error.set(
          'No pudimos enviar el formulario. Actualiza tu cita y verifica los datos y tu acceso.',
        );
      } else
        this.error.set(
          error instanceof ApplicationError && error.code === 'EXACT_READ_NOT_ENABLED'
            ? error.message
            : 'No pudimos comprobar el cierre. Conservamos la solicitud; vuelve a consultar sin duplicar la autorización.',
        );
    } finally {
      if (epoch === this.epoch) this.busy.set(false);
    }
  }
}
