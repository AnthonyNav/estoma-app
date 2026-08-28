import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { last, switchMap, takeWhile, timer } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { EntryLookupRequest, SupervisorEntryLookup } from '../domain/models/supervisor-entry';

type SupervisorAction = 'IDLE' | 'ARRIVAL' | 'DECISION' | 'FAILED';

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
});

@Component({
  selector: 'app-wash-entry-supervision-page',
  imports: [ReactiveFormsModule],
  templateUrl: './wash-entry-supervision.page.html',
  styleUrl: './wash-entry-supervision.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashEntrySupervisionPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
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
      this.action() === 'IDLE',
  );

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
    this.resetDecisionControls();

    this.supervision.lookup(request).subscribe({
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
    if (!appointmentId || this.action() !== 'IDLE') {
      return;
    }

    this.action.set('ARRIVAL');
    this.actionError.set(null);
    this.supervision
      .registerArrival({ appointmentId, idempotencyKey: this.createIdempotencyKey() })
      .pipe(switchMap(({ operationId }) => this.awaitOperation(operationId)))
      .subscribe({
        next: (operation) => this.completeOperation(operation.status === 'SUCCEEDED'),
        error: (error: unknown) => this.failAction(error),
      });
  }

  openRejection(event: MouseEvent): void {
    if (this.executionStatus() === 'PENDING_ENTRY' && this.action() === 'IDLE') {
      this.rejectionTrigger = event.currentTarget as HTMLElement;
      this.rejectionOpen.set(true);
      this.rejectionReason.set('');
      this.rejectionTouched.set(false);
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
    const { startsAt, endsAt } = lookup.appointment.timeSlot;
    return `${timeFormatter.format(new Date(startsAt))}–${timeFormatter.format(new Date(endsAt))}`;
  }

  private sendDecision(decision: 'AUTHORIZED' | 'REJECTED', rejectionReason: string | null): void {
    const execution = this.lookup()?.washExecution;
    if (!execution || execution.status !== 'PENDING_ENTRY' || this.action() !== 'IDLE') {
      return;
    }

    if (decision === 'AUTHORIZED' && !this.mayAuthorize()) {
      return;
    }

    this.action.set('DECISION');
    this.actionError.set(null);
    this.supervision
      .decideEntry({
        washExecutionId: execution.washExecutionId,
        expectedVersion: execution.version ?? 1,
        decision,
        identityConfirmed: this.identityConfirmed(),
        requirementsSatisfied: this.requirementsSatisfied(),
        rejectionReason,
        idempotencyKey: this.createIdempotencyKey(),
      })
      .pipe(switchMap(({ operationId }) => this.awaitOperation(operationId)))
      .subscribe({
        next: (operation) => this.completeOperation(operation.status === 'SUCCEEDED'),
        error: (error: unknown) => this.failAction(error),
      });
  }

  private completeOperation(succeeded: boolean): void {
    if (!succeeded) {
      this.action.set('FAILED');
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
    this.supervision.lookup(this.lastRequest).subscribe({
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

  private awaitOperation(operationId: string) {
    return timer(0, 600).pipe(
      switchMap(() => this.supervision.getOperation(operationId)),
      takeWhile((operation) => operation.status === 'PENDING', true),
      last(),
    );
  }

  private failAction(error: unknown): void {
    this.action.set('FAILED');
    this.actionError.set(
      error instanceof ApplicationError
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
