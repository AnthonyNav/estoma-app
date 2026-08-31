import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import {
  DecideWashEntryCommand,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../domain/models/supervisor-entry';

type SupervisorAction = 'IDLE' | 'ARRIVAL' | 'DECISION' | 'FAILED';

type PendingSupervisorAction =
  | {
      kind: 'ARRIVAL';
      command: RegisterWashArrivalCommand;
      operationId: string | null;
    }
  | {
      kind: 'DECISION';
      command: DecideWashEntryCommand;
      operationId: string | null;
    };

@Component({
  selector: 'app-wash-entry-supervision-page',
  imports: [ReactiveFormsModule],
  templateUrl: './wash-entry-supervision.page.html',
  styleUrl: './wash-entry-supervision.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashEntrySupervisionPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);
  private lastRequest: EntryLookupRequest | null = null;

  @ViewChild('rejectionDialog') private rejectionDialog?: ElementRef<HTMLDialogElement>;
  private rejectionTrigger: HTMLElement | null = null;

  readonly lookupForm = this.formBuilder.nonNullable.group({
    lookupType: ['STUDENT_ENROLLMENT' as EntryLookupRequest['lookupType']],
    query: ['201945678', Validators.required],
  });
  readonly lookup = signal<SupervisorEntryLookup | null>(null);
  readonly loadingLookup = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly action = signal<SupervisorAction>('IDLE');
  readonly actionError = signal<string | null>(null);
  readonly pendingAction = signal<PendingSupervisorAction | null>(null);
  readonly identityConfirmed = signal(false);
  readonly requirementsSatisfied = signal(false);
  readonly rejectionOpen = signal(false);
  readonly rejectionReason = signal('');
  readonly rejectionTouched = signal(false);
  readonly executionStatus = computed(() => this.lookup()?.washExecution?.status ?? 'NOT_ARRIVED');
  readonly mayAuthorize = computed(
    () =>
      this.executionStatus() === 'PENDING_ENTRY' &&
      this.identityConfirmed() &&
      this.requirementsSatisfied() &&
      (this.action() === 'IDLE' ||
        (this.action() === 'FAILED' && this.pendingAction()?.kind === 'DECISION')),
  );
  readonly mayRegisterArrival = computed(
    () =>
      this.action() === 'IDLE' ||
      (this.action() === 'FAILED' && this.pendingAction()?.kind === 'ARRIVAL'),
  );
  readonly mayOpenRejection = computed(() => {
    const pending = this.pendingAction();
    return (
      this.executionStatus() === 'PENDING_ENTRY' &&
      (this.action() === 'IDLE' ||
        (this.action() === 'FAILED' &&
          pending?.kind === 'DECISION' &&
          pending.command.decision === 'REJECTED'))
    );
  });

  search(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const request = this.createRequest();
    this.lastRequest = request;
    this.loadingLookup.set(true);
    this.lookupError.set(null);
    this.lookup.set(null);
    this.action.set('IDLE');
    this.pendingAction.set(null);
    this.resetDecisionControls();

    this.supervision
      .lookup(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookup) => {
          this.lookup.set(lookup);
          this.loadingLookup.set(false);
        },
        error: (error: unknown) => {
          this.lookupError.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible consultar la cita de hoy.',
          );
          this.loadingLookup.set(false);
        },
      });
  }

  registerArrival(): void {
    const appointmentId = this.lookup()?.appointment.appointmentId;
    if (!appointmentId || !this.mayRegisterArrival()) {
      return;
    }

    let pending = this.pendingAction();
    if (!pending) {
      pending = {
        kind: 'ARRIVAL',
        command: { appointmentId, idempotencyKey: this.createIdempotencyKey() },
        operationId: null,
      };
      this.pendingAction.set(pending);
    }
    if (pending.kind !== 'ARRIVAL') {
      return;
    }

    this.action.set('ARRIVAL');
    this.actionError.set(null);
    if (pending.operationId) {
      this.trackPendingAction(pending.operationId);
      return;
    }

    this.supervision
      .registerArrival(pending.command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) => {
          this.setPendingOperation(accepted.operationId);
          this.trackPendingAction(accepted.operationId, accepted.pollPath);
        },
        error: (error: unknown) => this.failAction(error),
      });
  }

  openRejection(event: MouseEvent): void {
    if (this.mayOpenRejection()) {
      this.rejectionTrigger = event.currentTarget as HTMLElement;
      this.rejectionOpen.set(true);
      if (!this.pendingAction()) {
        this.rejectionReason.set('');
        this.rejectionTouched.set(false);
      }
      setTimeout(() => {
        const dialog = this.rejectionDialog?.nativeElement;
        if (dialog && !dialog.open) {
          dialog.showModal();
        }
      });
    }
  }

  closeRejection(): void {
    if (this.action() !== 'DECISION') {
      const dialog = this.rejectionDialog?.nativeElement;
      if (dialog?.open) {
        dialog.close();
      } else {
        this.handleRejectionClosed();
      }
    }
  }

  handleRejectionClosed(): void {
    this.rejectionOpen.set(false);
    this.rejectionTrigger?.focus();
    this.rejectionTrigger = null;
  }

  preventRejectionDismissal(event: Event): void {
    if (this.action() === 'DECISION') {
      event.preventDefault();
    }
  }

  updateIdentityConfirmed(event: Event): void {
    this.identityConfirmed.set((event.target as HTMLInputElement).checked);
  }

  updateRequirementsSatisfied(event: Event): void {
    this.requirementsSatisfied.set((event.target as HTMLInputElement).checked);
  }

  updateRejectionReason(event: Event): void {
    this.rejectionReason.set((event.target as HTMLTextAreaElement).value);
    this.rejectionTouched.set(true);
  }

  authorize(): void {
    this.sendDecision('AUTHORIZED', null);
  }

  confirmRejection(): void {
    const reason = this.rejectionReason().trim();
    if (!reason) {
      this.rejectionTouched.set(true);
      return;
    }

    this.sendDecision('REJECTED', reason);
  }

  formatTimeSlot(lookup: SupervisorEntryLookup): string {
    const { startsAt, endsAt } = lookup.appointment.appointmentTimeSlot;
    const formatter = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone: lookup.appointment.appointmentTimeSlot.timezone,
    });
    return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
  }

  private sendDecision(decision: 'AUTHORIZED' | 'REJECTED', rejectionReason: string | null): void {
    const execution = this.lookup()?.washExecution;
    if (!execution || execution.status !== 'PENDING_ENTRY') {
      return;
    }

    if (decision === 'AUTHORIZED' && !this.mayAuthorize()) {
      return;
    }

    let pending = this.pendingAction();
    if (!pending) {
      pending = {
        kind: 'DECISION',
        command: {
          washExecutionId: execution.washExecutionId,
          expectedVersion: execution.executionVersion,
          decision,
          identityConfirmed: this.identityConfirmed(),
          requirementsSatisfied: this.requirementsSatisfied(),
          rejectionReason,
          idempotencyKey: this.createIdempotencyKey(),
        },
        operationId: null,
      };
      this.pendingAction.set(pending);
    }
    if (pending.kind !== 'DECISION' || pending.command.decision !== decision) {
      return;
    }

    this.action.set('DECISION');
    this.actionError.set(null);
    if (pending.operationId) {
      this.trackPendingAction(pending.operationId);
      return;
    }

    this.supervision
      .decideEntry(pending.command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) => {
          this.setPendingOperation(accepted.operationId);
          this.trackPendingAction(accepted.operationId, accepted.pollPath);
        },
        error: (error: unknown) => this.failAction(error),
      });
  }

  private completeOperation(succeeded: boolean): void {
    this.pendingAction.set(null);
    if (!succeeded) {
      this.action.set('IDLE');
      this.actionError.set(
        'La operación no se pudo completar. Actualiza la consulta e inténtalo otra vez.',
      );
      return;
    }

    this.action.set('IDLE');
    this.closeRejection();
    this.refreshLookup();
  }

  private refreshLookup(): void {
    if (!this.lastRequest) {
      return;
    }

    this.loadingLookup.set(true);
    this.supervision
      .lookup(this.lastRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookup) => {
          this.lookup.set(lookup);
          this.loadingLookup.set(false);
          this.resetDecisionControls();
        },
        error: (error: unknown) => {
          this.lookupError.set(
            error instanceof ApplicationError
              ? error.message
              : 'La operación se completó, pero no pudimos actualizar la consulta.',
          );
          this.loadingLookup.set(false);
        },
      });
  }

  private createRequest(): EntryLookupRequest {
    const { lookupType, query } = this.lookupForm.getRawValue();
    const value = query.trim();
    return lookupType === 'QR'
      ? { lookupType: 'QR', qrRepresentation: value }
      : { lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: value };
  }

  private setPendingOperation(operationId: string): void {
    this.pendingAction.update((pending) => (pending ? { ...pending, operationId } : pending));
  }

  private trackPendingAction(operationId: string, pollPath?: string): void {
    const tracked = pollPath
      ? this.operationTracker.trackAccepted(
          { operationId, pollPath },
          () => this.supervision.getOperation(operationId),
          {
            intervalMs: 600,
            maxPendingPolls: 100,
          },
        )
      : this.operationTracker.trackWith(() => this.supervision.getOperation(operationId), {
          intervalMs: 600,
          maxPendingPolls: 100,
        });
    tracked.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (operation) => this.completeOperation(operation.status === 'SUCCEEDED'),
      error: (error: unknown) => this.failAction(error),
    });
  }

  private failAction(error: unknown): void {
    this.action.set('FAILED');
    this.actionError.set(
      this.pendingAction()?.operationId
        ? 'No pudimos comprobar la operación. Reintenta para consultar la misma operación.'
        : error instanceof ApplicationError
          ? error.message
          : 'No fue posible guardar la decisión. Inténtalo nuevamente.',
    );
  }

  private resetDecisionControls(): void {
    this.identityConfirmed.set(false);
    this.requirementsSatisfied.set(false);
    this.rejectionOpen.set(false);
    this.rejectionReason.set('');
    this.rejectionTouched.set(false);
    this.actionError.set(null);
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
