import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { last, switchMap, takeWhile, timer } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import {
  AppointmentAvailability,
  AvailableTimeSlot,
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
  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);
  private readonly appointmentRegistration = inject(WashAppointmentRegistrationUseCase);

  @ViewChild('confirmationDialog') private confirmationDialog?: ElementRef<HTMLDialogElement>;
  private confirmationTrigger: HTMLElement | null = null;

  readonly availability = signal<AppointmentAvailability | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly submissionError = signal<string | null>(null);
  readonly confirmationOpen = signal(false);
  readonly submissionState = signal<SubmissionState>('IDLE');
  readonly selectedTimeSlot = this.registration.selectedTimeSlot;
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
    if (this.submissionState() !== 'SUBMITTING') {
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

  confirmSchedule(): void {
    const timeSlot = this.selectedTimeSlot();
    const availability = this.availability();
    if (!timeSlot || !availability) {
      return;
    }

    this.submissionState.set('SUBMITTING');
    this.submissionError.set(null);
    const draft = this.registration.draft();

    this.appointmentRegistration
      .schedule({
        ...draft,
        appointmentTimeSlotId: timeSlot.appointmentTimeSlotId,
        exceptionalAuthorizationId: availability.exceptionalAuthorizationId,
        idempotencyKey: this.createIdempotencyKey(),
      })
      .pipe(switchMap(({ operationId }) => this.awaitOperation(operationId)))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'SUCCEEDED') {
            this.registration.reset();
            void this.router.navigate(['/wash/student']);
            return;
          }

          this.submissionState.set('FAILED');
          this.submissionError.set(
            'No fue posible confirmar la cita. Intenta seleccionar otro horario.',
          );
        },
        error: (error: unknown) => {
          this.submissionState.set('FAILED');
          this.submissionError.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible confirmar la cita. Inténtalo nuevamente.',
          );
        },
      });
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

  private loadAvailability(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const { appointmentType, instrumentCount, pieceType, courseSectionId } =
      this.registration.draft();

    this.appointmentRegistration
      .getAvailability({ appointmentType, instrumentCount, pieceType, courseSectionId })
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

  private awaitOperation(operationId: string) {
    return timer(0, 600).pipe(
      switchMap(() => this.appointmentRegistration.getOperation(operationId)),
      takeWhile((operation) => operation.status === 'PENDING', true),
      last(),
    );
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `wash-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
