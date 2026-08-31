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
import { Router, RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import {
  AppointmentAvailability,
  AvailableTimeSlot,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../domain/models/appointment-registration';
import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';

type SubmissionState = 'IDLE' | 'SUBMITTING' | 'FAILED';

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Mexico_City',
});

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
});

@Component({
  selector: 'app-wash-appointment-availability-page',
  imports: [RouterLink],
  templateUrl: './wash-appointment-availability.page.html',
  styleUrl: './wash-appointment-availability.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashAppointmentAvailabilityPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);
  private readonly appointmentRegistration = inject(WashAppointmentRegistrationUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  @ViewChild('confirmationDialog') private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private confirmationTrigger: HTMLElement | null = null;

  readonly availability = signal<AppointmentAvailability | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly submissionError = signal<string | null>(null);
  readonly confirmationOpen = signal(false);
  readonly submissionState = signal<SubmissionState>('IDLE');
  readonly selectedTimeSlot = this.registration.selectedTimeSlot;
  readonly pendingSchedule = this.registration.pendingSchedule;
  readonly canSchedule = computed(
    () => this.availability()?.canSchedule === true && this.selectedTimeSlot() !== null,
  );

  constructor() {
    const draft = this.registration.draft();
    if (!draft.regulationAccepted || !draft.courseSectionId) {
      void this.router.navigate(['/wash/appointments/regulation']);
      return;
    }

    this.loadAvailability();
  }

  selectTimeSlot(timeSlot: AvailableTimeSlot): void {
    if (this.submissionState() !== 'SUBMITTING' && !this.pendingSchedule()) {
      this.registration.selectTimeSlot(timeSlot);
      this.submissionState.set('IDLE');
      this.submissionError.set(null);
    }
  }

  openConfirmation(event: MouseEvent): void {
    if (this.canSchedule()) {
      this.confirmationTrigger = event.currentTarget as HTMLElement;
      this.submissionError.set(null);
      this.confirmationOpen.set(true);
      setTimeout(() => {
        const dialog = this.confirmationDialog?.nativeElement;
        if (dialog && !dialog.open) {
          dialog.showModal();
        }
      });
    }
  }

  closeConfirmation(): void {
    if (this.submissionState() !== 'SUBMITTING') {
      const dialog = this.confirmationDialog?.nativeElement;
      if (dialog?.open) {
        dialog.close();
      } else {
        this.handleConfirmationClosed();
      }
    }
  }

  handleConfirmationClosed(): void {
    this.confirmationOpen.set(false);
    this.confirmationTrigger?.focus();
    this.confirmationTrigger = null;
  }

  preventConfirmationDismissal(event: Event): void {
    if (this.submissionState() === 'SUBMITTING') {
      event.preventDefault();
    }
  }

  confirmSchedule(): void {
    if (this.submissionState() === 'SUBMITTING') {
      return;
    }

    this.submissionState.set('SUBMITTING');
    this.submissionError.set(null);
    const pending = this.pendingSchedule();
    if (pending) {
      if (pending.operationId) {
        this.trackScheduleOperation(pending.operationId);
      } else {
        this.submitSchedule(pending.command);
      }
      return;
    }

    const timeSlot = this.selectedTimeSlot();
    const availability = this.availability();
    if (!timeSlot || !availability) {
      this.submissionState.set('IDLE');
      return;
    }

    const command: ScheduleAppointmentCommand = {
      ...this.registration.draft(),
      appointmentTimeSlotId: timeSlot.appointmentTimeSlotId,
      exceptionalAuthorizationId: availability.exceptionalAuthorizationId,
      idempotencyKey: this.createIdempotencyKey(),
    };
    this.registration.beginSchedule(command);
    this.submitSchedule(command);
  }

  formatSlot(timeSlot: AvailableTimeSlot): string {
    const start = new Date(timeSlot.startsAt);
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(
      new Date(timeSlot.endsAt),
    )}`;
  }

  formatDeadline(timeSlot: AvailableTimeSlot): string {
    return `Reserva hasta ${timeFormatter.format(new Date(timeSlot.bookingDeadlineAt))}`;
  }

  retry(): void {
    this.loadAvailability();
  }

  private submitSchedule(command: ScheduleAppointmentCommand): void {
    this.appointmentRegistration
      .schedule(command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) => {
          this.registration.setScheduleOperation(accepted.operationId);
          this.trackScheduleOperation(accepted.operationId, accepted.pollPath);
        },
        error: (error: unknown) => this.failSubmission(error, false),
      });
  }

  private loadAvailability(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const { appointmentType, instrumentCount, pieceType, courseSectionId } =
      this.registration.draft();

    this.appointmentRegistration
      .getAvailability({ appointmentType, instrumentCount, pieceType, courseSectionId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (availability) => {
          this.availability.set(availability);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loadError.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible consultar los horarios disponibles.',
          );
          this.loading.set(false);
        },
      });
  }

  private trackScheduleOperation(operationId: string, pollPath?: string): void {
    const tracked = pollPath
      ? this.operationTracker.trackAccepted(
          { operationId, pollPath },
          () => this.appointmentRegistration.getOperation(operationId),
          {
            intervalMs: 600,
            maxPendingPolls: 100,
          },
        )
      : this.operationTracker.trackWith(
          () => this.appointmentRegistration.getOperation(operationId),
          {
            intervalMs: 600,
            maxPendingPolls: 100,
          },
        );
    tracked.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (operation) => this.completeScheduleOperation(operation),
      error: (error: unknown) => this.failSubmission(error, true),
    });
  }

  private completeScheduleOperation(operation: DurableOperation): void {
    if (operation.status === 'SUCCEEDED') {
      this.registration.reset();
      void this.router.navigate(['/wash/student']);
      return;
    }

    this.registration.clearPendingSchedule();
    this.submissionState.set('FAILED');
    this.submissionError.set(
      'No fue posible confirmar la cita. Actualiza los horarios e inténtalo nuevamente.',
    );
  }

  private failSubmission(error: unknown, operationAccepted: boolean): void {
    this.submissionState.set('FAILED');
    this.submissionError.set(
      operationAccepted
        ? 'No pudimos comprobar la confirmación. Reintenta para consultar la misma operación.'
        : error instanceof ApplicationError
          ? error.message
          : 'No fue posible confirmar la cita. Inténtalo nuevamente.',
    );
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `wash-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
