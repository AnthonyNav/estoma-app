import {
  afterNextRender,
  Injector,
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
import { defer, retry, throwError, timer } from 'rxjs';
import { bookingMessage } from '../application/booking-messages';
import { NgTemplateOutlet } from '@angular/common';
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
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './wash-appointment-availability.page.html',
  styleUrl: './wash-appointment-availability.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashAppointmentAvailabilityPage {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);
  private readonly appointmentRegistration = inject(WashAppointmentRegistrationUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  @ViewChild('confirmationDialog') private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private confirmationTrigger: HTMLElement | null = null;

  readonly draft = this.registration.draft;
  readonly courseLabel = this.registration.courseLabel;
  readonly typeLabel = computed(
    () =>
      ({ NORMAL: 'Normal', JOURNEY: 'Jornada clínica', IMMUNOCOMPROMISED: 'Inmunocomprometido' })[
        this.draft().appointmentType
      ],
  );
  readonly pieceLabel = computed(
    () =>
      ({
        HIGH_SPEED: 'Alta velocidad',
        LOW_SPEED: 'Baja velocidad',
        CONTRA_ANGLE: 'Contra-ángulo',
      })[this.draft().pieceType],
  );
  readonly serviceDayLabel = computed(() => {
    const first = this.availability()?.availableTimeSlots[0];
    return first ? dateFormatter.format(new Date(first.startsAt)) : '';
  });

  readonly availability = signal<AppointmentAvailability | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly submissionError = signal<string | null>(null);
  readonly confirmationOpen = signal(false);
  readonly submissionState = signal<SubmissionState>('IDLE');
  readonly selectedTimeSlot = this.registration.selectedTimeSlot;
  readonly pendingSchedule = this.registration.pendingSchedule;
  readonly bookingMessage = bookingMessage;
  readonly canSchedule = computed(() => {
    const availability = this.availability();
    const slot = this.selectedTimeSlot();
    return (
      !this.loading() &&
      !this.pendingSchedule() &&
      availability?.canSchedule === true &&
      !!slot &&
      availability.availableTimeSlots.some(
        (item) => item.appointmentTimeSlotId === slot.appointmentTimeSlotId,
      ) &&
      (!availability.exceptionalAuthorizationRequired ||
        (availability.exceptionalAuthorizationAvailable &&
          !!availability.exceptionalAuthorizationId))
    );
  });

  constructor() {
    if (this.pendingSchedule()) {
      this.loading.set(false);
      return;
    }
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
      afterNextRender(
        () => {
          const dialog = this.confirmationDialog?.nativeElement;
          if (dialog && !dialog.open) {
            dialog.showModal();
          }
        },
        { injector: this.injector },
      );
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

    const pending = this.pendingSchedule();
    if (!pending && !this.canSchedule()) return;
    if (pending?.result?.status === 'SUCCEEDED') {
      void this.router.navigate(['/wash/student']);
      return;
    }
    this.submissionState.set('SUBMITTING');
    this.submissionError.set(null);
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
      exceptionalAuthorizationId: availability.exceptionalAuthorizationRequired
        ? availability.exceptionalAuthorizationId
        : null,
      idempotencyKey: this.createIdempotencyKey(),
    };
    this.confirmationDialog?.nativeElement.close();
    this.confirmationOpen.set(false);
    if (this.registration.beginSchedule(command) === false) {
      this.submissionState.set('IDLE');
      this.submissionError.set(this.registration.storageError());
      return;
    }
    this.submitSchedule(command);
  }

  formatSlot(timeSlot: AvailableTimeSlot): string {
    const start = new Date(timeSlot.startsAt);
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(
      new Date(timeSlot.endsAt),
    )}`;
  }

  formatTime(timeSlot: AvailableTimeSlot): string {
    return `${timeFormatter.format(new Date(timeSlot.startsAt))}–${timeFormatter.format(new Date(timeSlot.endsAt))}`;
  }

  formatDeadline(timeSlot: AvailableTimeSlot): string {
    return `Reserva hasta ${timeFormatter.format(new Date(timeSlot.bookingDeadlineAt))}`;
  }

  retry(): void {
    this.loadAvailability();
  }

  private submitSchedule(command: ScheduleAppointmentCommand): void {
    const previouslyAttempted = this.pendingSchedule()?.attempted === true;
    if (!this.registration.markAttempted()) {
      this.submissionState.set('FAILED');
      this.submissionError.set(this.registration.storageError());
      return;
    }
    this.appointmentRegistration
      .schedule(command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => {
          this.registration.setScheduleOperation(operationId);
          this.trackScheduleOperation(operationId);
        },
        error: (error: unknown) => this.failSubmission(error, previouslyAttempted),
      });
  }

  private loadAvailability(): void {
    if (this.pendingSchedule()) return;
    this.loading.set(true);
    this.availability.set(null);
    this.registration.selectedTimeSlot.set(null);
    this.loadError.set(null);
    const { appointmentType, instrumentCount, pieceType, courseSectionId } =
      this.registration.draft();

    defer(() =>
      this.appointmentRegistration.getAvailability({
        appointmentType,
        instrumentCount,
        pieceType,
        courseSectionId,
      }),
    )
      .pipe(
        retry({
          count: 3,
          delay: (error: unknown, attempt) => {
            if (
              !(error instanceof ApplicationError) ||
              error.status !== 503 ||
              error.code !== 'BFF.PROJECTION_UNAVAILABLE'
            )
              return throwError(() => error);
            const wait = error.retryAfterMs ?? attempt * 1000;
            return wait <= 10000 ? timer(Math.max(1000, wait)) : throwError(() => error);
          },
        }),
        takeUntilDestroyed(this.destroyRef),
      )
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

  private trackScheduleOperation(operationId: string): void {
    this.operationTracker
      .trackWith(
        () =>
          defer(() => this.appointmentRegistration.getOperation(operationId)).pipe(
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
        {
          intervalMs: 1000,
          maxPendingPolls: 45,
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => this.completeScheduleOperation(operation),
        error: (error: unknown) => this.failSubmission(error, true),
      });
  }

  private completeScheduleOperation(operation: DurableOperation): void {
    if (operation.status === 'PENDING') return;
    this.registration.setResult(operation);
    if (operation.status === 'SUCCEEDED') {
      void this.router.navigate(['/wash/student']);
      return;
    }
    this.submissionState.set('FAILED');
    this.submissionError.set(bookingMessage(operation.errorCode));
    if (operation.status === 'REJECTED') {
      this.registration.clearPendingSchedule();
      this.closeConfirmation();
      if (
        ['ACTIVE_APPOINTMENT_EXISTS', 'APPOINTMENT_ALREADY_EXISTS'].includes(
          operation.errorCode ?? '',
        )
      ) {
        void this.router.navigate(['/wash/student']);
      } else this.loadAvailability();
    }
  }

  private failSubmission(error: unknown, operationAccepted: boolean): void {
    this.submissionState.set('FAILED');
    if (
      !operationAccepted &&
      error instanceof ApplicationError &&
      [400, 403, 422].includes(error.status ?? 0)
    ) {
      this.registration.clearPendingSchedule();
      this.closeConfirmation();
    }
    this.submissionError.set(
      operationAccepted
        ? 'No pudimos comprobar la confirmación. Reintenta para consultar la misma operación.'
        : error instanceof ApplicationError
          ? error.message
          : 'No fue posible confirmar la cita. Inténtalo nuevamente.',
    );
  }

  private createIdempotencyKey(): string {
    return crypto.randomUUID();
  }
}
