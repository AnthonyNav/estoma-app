import { environment } from '../../../../environments/environment';
import { SUPERVISOR_EXIT_GATEWAY } from '../../wash-exit/domain/supervisor-exit';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, map, retry, takeUntil, throwError, timer } from 'rxjs';
import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import {
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from './wash-entry-supervision.use-case';
export type PendingEntryAction = {
  request: EntryLookupRequest;
  appointmentId: string;
  operationId?: string;
  pollPath?: string;
  snapshot?: SupervisorEntryLookup;
  intent?: { decision: 'AUTHORIZED' | 'REJECTED'; reason: string };
  arrivalReceipt?: {
    command: RegisterWashArrivalCommand;
    operationId?: string;
    pollPath?: string;
    result?: DurableOperation;
  };
  result?: DurableOperation;
} & (
  | { kind: 'ARRIVAL'; command: RegisterWashArrivalCommand }
  | { kind: 'DECISION'; command: DecideWashEntryCommand }
);
const errors: Record<string, string> = {
  ARRIVAL_TOO_EARLY: 'Aún no comienza la ventana de llegada de esta cita.',
  ARRIVAL_TOLERANCE_EXCEEDED: 'El tiempo de tolerancia para registrar la llegada terminó.',
  APPOINTMENT_NOT_SCHEDULED: 'La cita ya no permite registrar una llegada.',
  WASH_EXECUTION_ALREADY_EXISTS: 'La llegada ya fue registrada. Estamos consultando su estado.',
  VERSION_CONFLICT: 'La atención cambió. Revisa los datos actualizados antes de decidir.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  INVALID_ENTRY_DECISION:
    'Revisa la identidad, los requisitos y el motivo antes de enviar la decisión.',
};
@Injectable({ providedIn: 'root' })
export class SupervisorEntryWorkflowService {
  private readonly api = inject(WashEntrySupervisionUseCase);
  private readonly exact = inject(SUPERVISOR_EXIT_GATEWAY);
  private readonly tracker = inject(OperationTrackerService);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly session = inject(SessionStore);
  private readonly receipts = signal(this.restore());
  private request: EntryLookupRequest | null = null;
  readonly lookup = signal<SupervisorEntryLookup | null>(null);
  readonly authorizedHere = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly pending = computed(
    () => this.receipts().get(this.session.session()?.accountId ?? '') ?? null,
  );
  readonly freeRejectionEnabled =
    environment.useMockApi || environment.enableUnclassifiedEntryRejection;
  readonly canStartDecision = computed(() => this.canArrive() || this.canDecide());
  readonly canArrive = computed(
    () =>
      !this.busy() &&
      !this.pending() &&
      this.lookup()?.nextAction === 'ENTRY' &&
      this.lookup()?.appointment.appointmentStatus === 'SCHEDULED' &&
      !this.lookup()?.washExecution,
  );
  readonly canDecide = computed(
    () =>
      !this.busy() &&
      !this.pending() &&
      this.lookup()?.nextAction === 'ENTRY_DECISION' &&
      this.lookup()?.washExecution?.status === 'PENDING_ENTRY' &&
      Number.isInteger(this.lookup()?.washExecution?.executionVersion) &&
      (this.lookup()?.washExecution?.executionVersion ?? 0) > 0,
  );
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.busy.set(false);
      this.authorizedHere.set(false);
      this.lookup.set(null);
      this.request = null;
      this.error.set(null);
    });
  }
  private restore(): Map<string, PendingEntryAction> {
    try {
      return new Map(JSON.parse(sessionStorage.getItem('estoma.entry.receipts.v2') ?? '[]'));
    } catch {
      return new Map();
    }
  }
  private persist(values: Map<string, PendingEntryAction>): boolean {
    try {
      sessionStorage.setItem('estoma.entry.receipts.v2', JSON.stringify([...values]));
      this.receipts.set(values);
      return true;
    } catch {
      if (this.pending()) this.receipts.set(values);
      this.error.set(
        'No pudimos guardar el seguimiento en este navegador. Habilita el almacenamiento antes de continuar.',
      );
      return false;
    }
  }
  private save(value: PendingEntryAction): boolean {
    const owner = this.session.session()?.accountId;
    if (!owner) return false;
    return this.persist(new Map(this.receipts()).set(owner, value));
  }
  private clear(): void {
    const owner = this.session.session()?.accountId;
    if (!owner) return;
    const values = new Map(this.receipts());
    values.delete(owner);
    this.persist(values);
  }
  search(request: EntryLookupRequest): void {
    if (this.busy() || this.pending()) return;
    this.authorizedHere.set(false);
    this.request = request;
    this.lookup.set(null);
    this.error.set(null);
    this.read(request);
  }
  reset(): void {
    if (!this.busy() && !this.pending()) {
      this.authorizedHere.set(false);
      this.lookup.set(null);
      this.request = null;
      this.error.set(null);
    }
  }
  refresh(): void {
    if (this.busy()) return;
    if (this.pending()) this.resume();
    else if (this.request) {
      this.error.set(null);
      this.read(this.request);
    }
  }
  arrive(): void {
    if (!this.canArrive() || !this.request) return;
    const appointmentId = this.lookup()!.appointment.appointmentId;
    if (
      !this.save({
        kind: 'ARRIVAL',
        request: {
          lookupType: 'STUDENT_ENROLLMENT',
          studentEnrollment: this.lookup()!.student.studentEnrollment,
        },
        snapshot: this.lookup()!,
        appointmentId,
        command: { appointmentId, idempotencyKey: crypto.randomUUID() },
      })
    )
      return;
    this.resume();
  }
  decide(
    decision: 'AUTHORIZED' | 'REJECTED',
    identityConfirmed: boolean,
    requirementsSatisfied: boolean,
    reason: string,
  ): void {
    if (!this.canStartDecision() || !this.request) return;
    if (decision === 'AUTHORIZED' && (!identityConfirmed || !requirementsSatisfied)) return;
    if (decision === 'REJECTED' && (!reason.trim() || reason.trim().length > 500)) return;
    if (decision === 'REJECTED' && !this.freeRejectionEnabled) {
      this.error.set('El rechazo con motivo libre todavía no está habilitado en este entorno.');
      return;
    }
    const lookup = this.lookup()!;
    const intent = { decision, reason: reason.trim() };
    const request: EntryLookupRequest = {
      lookupType: 'STUDENT_ENROLLMENT',
      studentEnrollment: lookup.student.studentEnrollment,
    };
    this.error.set(null);
    if (this.canArrive()) {
      if (
        this.save({
          kind: 'ARRIVAL',
          request,
          snapshot: lookup,
          appointmentId: lookup.appointment.appointmentId,
          intent,
          command: {
            appointmentId: lookup.appointment.appointmentId,
            idempotencyKey: crypto.randomUUID(),
          },
        })
      )
        this.resume();
    } else this.startDecision(lookup, intent, request);
  }
  private startDecision(
    lookup: SupervisorEntryLookup,
    intent: { decision: 'AUTHORIZED' | 'REJECTED'; reason: string },
    request: EntryLookupRequest,
    arrival?: PendingEntryAction,
  ): void {
    const execution = lookup.washExecution!;
    const command: DecideWashEntryCommand = {
      washExecutionId: execution.washExecutionId,
      expectedVersion: execution.executionVersion,
      decision: intent.decision,
      rejectionReason: intent.decision === 'REJECTED' ? intent.reason : null,
      idempotencyKey: crypto.randomUUID(),
      ...(intent.decision === 'AUTHORIZED'
        ? { identityConfirmed: true, requirementsSatisfied: true }
        : {}),
    };
    const receipt: PendingEntryAction = {
      kind: 'DECISION',
      request,
      snapshot: lookup,
      appointmentId: lookup.appointment.appointmentId,
      command,
      ...(arrival?.kind === 'ARRIVAL'
        ? {
            arrivalReceipt: {
              command: arrival.command,
              operationId: arrival.operationId,
              pollPath: arrival.pollPath,
              result: arrival.result,
            },
          }
        : {}),
    };
    if (this.save(receipt)) {
      this.busy.set(false);
      this.resume();
    }
  }
  resume(): void {
    const pending = this.pending();
    if (!pending || this.busy()) return;
    this.error.set(null);
    if (
      pending.result?.status === 'SUCCEEDED' ||
      pending.result?.errorCode === 'WASH_EXECUTION_ALREADY_EXISTS'
    ) {
      this.read(pending.request, 0);
      return;
    }
    this.busy.set(true);
    if (pending.operationId) {
      this.poll(pending);
      return;
    }
    const submit =
      pending.kind === 'ARRIVAL'
        ? this.api.registerArrival(pending.command)
        : this.api.decideEntry(pending.command);
    submit.pipe(takeUntil(this.lifecycle.ended$)).subscribe({
      next: (accepted) => {
        const next = { ...pending, operationId: accepted.operationId, pollPath: accepted.pollPath };
        this.save(next);
        this.poll(next);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        if (
          error instanceof ApplicationError &&
          ([400, 403, 422].includes(error.status ?? 0) ||
            error.code === 'BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE')
        ) {
          this.clear();
          this.error.set(
            error.code === 'BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE'
              ? 'El rechazo con motivo libre está deshabilitado. No se creó una operación.'
              : 'No se pudo registrar la solicitud. Revisa tu acceso y los datos.',
          );
          this.read(pending.request);
        } else
          this.error.set(
            'No pudimos comprobar si se recibió la solicitud. Vuelve a consultar; conservaremos la misma referencia.',
          );
      },
    });
  }
  private poll(pending: PendingEntryAction): void {
    this.tracker
      .trackWith(() => this.retryRead(() => this.api.getOperation(pending.operationId!)), {
        intervalMs: 1000,
        maxPendingPolls: 45,
      })
      .pipe(takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (result) => {
          if (result.status === 'PENDING') return;
          if (
            result.status === 'REJECTED' &&
            pending.kind === 'ARRIVAL' &&
            result.errorCode === 'WASH_EXECUTION_ALREADY_EXISTS'
          ) {
            this.save({ ...pending, result });
            this.read(pending.request);
            return;
          }
          if (result.status === 'REJECTED') {
            this.clear();
            this.error.set(
              errors[result.errorCode ?? ''] ??
                'La solicitud fue rechazada. Revisa el estado actualizado antes de continuar.',
            );
            this.read(pending.request);
          } else {
            this.save({ ...pending, result });
            if (result.status === 'SUCCEEDED') this.read(pending.request, 0);
            else {
              this.busy.set(false);
              this.error.set(
                'El resultado no es concluyente. Conserva la referencia y solicita apoyo antes de intentar otra acción.',
              );
            }
          }
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'La comprobación no pudo terminar. Puedes volver a consultar la misma solicitud.',
          );
        },
      });
  }
  private retryRead<T>(read: () => import('rxjs').Observable<T>) {
    return defer(read).pipe(
      retry({
        count: 2,
        delay: (error: unknown, attempt) => {
          if (!(error instanceof ApplicationError) || ![429, 503].includes(error.status ?? 0))
            return throwError(() => error);
          const wait = error.retryAfterMs ?? attempt * 1000;
          return wait <= 10000 ? timer(Math.max(1000, wait)) : throwError(() => error);
        },
      }),
    );
  }
  private read(request: EntryLookupRequest, attempt = 0): void {
    this.busy.set(true);
    const active = this.pending();
    const readContext = () =>
      active?.kind === 'DECISION' && active.snapshot
        ? this.exact.detail(active.command.washExecutionId).pipe(
            map((detail) => {
              const base = active.snapshot!;
              return {
                ...base,
                student: detail.student,
                appointment: {
                  ...base.appointment,
                  appointmentId: detail.appointment.appointmentId,
                  appointmentStatus: detail.appointment
                    .appointmentStatus as SupervisorEntryLookup['appointment']['appointmentStatus'],
                },
                washExecution: {
                  ...base.washExecution!,
                  ...detail.washExecution,
                  status: detail.washExecution.status as NonNullable<
                    SupervisorEntryLookup['washExecution']
                  >['status'],
                },
                activeResourceAssignment: detail.washExecution.activeResourceAssignment,
                nextAction: 'NONE' as const,
              };
            }),
          )
        : this.api.lookup(request);
    this.retryRead(readContext)
      .pipe(takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (lookup) => {
          this.lookup.set(lookup);
          this.request = request;
          const pending = this.pending();
          if (
            pending?.result?.status === 'SUCCEEDED' ||
            pending?.result?.errorCode === 'WASH_EXECUTION_ALREADY_EXISTS'
          ) {
            const execution = lookup.washExecution;
            const expectedStatus = pending.result.data?.status;
            const converged =
              lookup.appointment.appointmentId === pending.appointmentId &&
              !!execution &&
              ((pending.kind === 'ARRIVAL' &&
                execution.status === 'PENDING_ENTRY' &&
                execution.executionVersion > 0) ||
                (pending.kind === 'DECISION' &&
                  execution.washExecutionId === pending.command.washExecutionId &&
                  execution.executionVersion > pending.command.expectedVersion &&
                  (expectedStatus
                    ? execution.status === expectedStatus
                    : pending.command.decision === 'REJECTED'
                      ? execution.status === 'ENTRY_REJECTED'
                      : ['IN_PROGRESS', 'PENDING_REASSIGNMENT'].includes(execution.status))));
            if (converged) {
              if (pending.kind === 'ARRIVAL' && pending.intent) {
                this.startDecision(lookup, pending.intent, pending.request, pending);
                return;
              }
              this.authorizedHere.set(
                pending.kind === 'DECISION' && pending.command.decision === 'AUTHORIZED',
              );
              this.clear();
            } else if (attempt < 19) {
              timer(1500)
                .pipe(takeUntil(this.lifecycle.ended$))
                .subscribe(() => this.read(request, attempt + 1));
              return;
            } else
              this.error.set(
                'La operación terminó, pero la consulta aún no refleja el cambio. Actualiza sin repetir la acción.',
              );
          }
          this.busy.set(false);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.error.set(
            error instanceof ApplicationError
              ? error.code === 'BFF.PROJECTION_UNAVAILABLE'
                ? 'La información aún no está disponible. Intenta consultar nuevamente.'
                : error.message
              : 'No pudimos consultar la cita. Revisa la conexión e inténtalo otra vez.',
          );
        },
      });
  }
}
