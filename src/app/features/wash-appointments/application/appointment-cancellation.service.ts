import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, retry, takeUntil, throwError, timer } from 'rxjs';
import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import {
  CancelAppointmentCommand,
  DurableOperation,
} from '../domain/models/appointment-registration';
import { WashAppointmentRegistrationUseCase } from './wash-appointment-registration.use-case';

interface Cancellation {
  command: CancelAppointmentCommand;
  attempted?: boolean;
  operationId?: string;
  result?: DurableOperation;
}
@Injectable({ providedIn: 'root' })
export class AppointmentCancellationService {
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly useCase = inject(WashAppointmentRegistrationUseCase);
  private readonly tracker = inject(OperationTrackerService);
  private readonly receipts = signal(this.restore());
  readonly pending = computed(
    () => this.receipts().get(this.session.session()?.accountId ?? '') ?? null,
  );
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly settled = signal(0);
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.busy.set(false);
      this.message.set(null);
    });
  }
  private restore(): Map<string, Cancellation> {
    try {
      return new Map(JSON.parse(sessionStorage.getItem('estoma.cancellation.receipts.v1') ?? '[]'));
    } catch {
      return new Map();
    }
  }
  private persist(values: Map<string, Cancellation>): boolean {
    try {
      sessionStorage.setItem('estoma.cancellation.receipts.v1', JSON.stringify([...values]));
      this.receipts.set(values);
      return true;
    } catch {
      if (this.pending()) this.receipts.set(values);
      this.message.set(
        'No pudimos guardar el seguimiento. Habilita el almacenamiento del navegador antes de continuar.',
      );
      return false;
    }
  }
  private save(owner: string, value: Cancellation): boolean {
    return this.persist(new Map(this.receipts()).set(owner, value));
  }
  clear(): void {
    const owner = this.session.session()?.accountId;
    if (!owner) return;
    const next = new Map(this.receipts());
    next.delete(owner);
    this.persist(next);
  }
  start(appointmentId: string, expectedVersion: number): void {
    if (this.pending() || this.busy()) return;
    const owner = this.session.session()?.accountId;
    if (!owner) return;
    if (
      !this.save(owner, {
        command: { appointmentId, expectedVersion, idempotencyKey: crypto.randomUUID() },
      })
    )
      return;
    this.resume();
  }
  resume(): void {
    const pending = this.pending();
    const owner = this.session.session()?.accountId;
    if (!pending || !owner || this.busy() || pending.result?.status === 'SUCCEEDED') return;
    this.busy.set(true);
    this.message.set(null);
    if (pending.operationId) {
      this.poll(owner, pending);
      return;
    }
    if (!this.save(owner, { ...pending, attempted: true })) {
      this.busy.set(false);
      return;
    }
    this.useCase
      .cancel(pending.command)
      .pipe(takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (accepted) => {
          const acceptedPending = { ...pending, operationId: accepted.operationId };
          this.save(owner, acceptedPending);
          this.poll(owner, acceptedPending);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          if (
            !pending.attempted &&
            error instanceof ApplicationError &&
            [400, 403, 422].includes(error.status ?? 0)
          ) {
            this.clear();
            this.settled.update((value) => value + 1);
            this.message.set(
              'No fue posible solicitar la cancelación. Actualiza la cita y revisa tu acceso.',
            );
          } else
            this.message.set(
              'No pudimos comprobar la cancelación. Vuelve a consultar la misma solicitud.',
            );
        },
      });
  }
  private poll(owner: string, pending: Cancellation): void {
    this.tracker
      .trackWith(
        () =>
          defer(() => this.useCase.getOperation(pending.operationId!)).pipe(
            retry({
              count: 2,
              delay: (error: unknown, attempt) => {
                if (!(error instanceof ApplicationError) || ![429, 503].includes(error.status ?? 0))
                  return throwError(() => error);
                const wait = error.retryAfterMs ?? attempt * 1000;
                return wait <= 10000 ? timer(Math.max(1000, wait)) : throwError(() => error);
              },
            }),
          ),
        { maxPendingPolls: 45 },
      )
      .pipe(takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (result) => {
          if (result.status === 'PENDING') return;
          this.busy.set(false);
          if (result.status === 'REJECTED') {
            this.clear();
            const messages: Record<string, string> = {
              CANCELLATION_DEADLINE_PASSED: 'El plazo para cancelar ya terminó.',
              VERSION_CONFLICT:
                'La cita cambió mientras intentabas cancelarla. Revisa su estado actualizado.',
              FORBIDDEN: 'No tienes permiso para cancelar esta cita.',
              INVALID_CANCELLATION: 'La cita ya no se puede cancelar en su estado actual.',
              APPOINTMENT_NOT_FOUND: 'La cita ya no está disponible.',
            };
            this.message.set(
              messages[result.errorCode ?? ''] ??
                'La cancelación fue rechazada. Revisa el estado de tu cita.',
            );
          } else {
            this.save(owner, { ...pending, result });
            if (result.status !== 'SUCCEEDED')
              this.message.set(
                'No podemos determinar el resultado. Conserva la referencia y solicita apoyo al área de Lavado.',
              );
          }
          this.settled.update((value) => value + 1);
        },
        error: () => {
          this.busy.set(false);
          this.message.set(
            'La comprobación no pudo terminar. Puedes volver a consultar sin enviar otra cancelación.',
          );
          this.settled.update((value) => value + 1);
        },
      });
  }
}
