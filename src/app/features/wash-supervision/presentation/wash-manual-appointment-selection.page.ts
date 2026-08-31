import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import {
  SupervisorLookup,
  SupervisorManualAppointment,
  SupervisorManualAppointments,
} from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-manual-appointment-selection-page',
  imports: [RouterLink],
  templateUrl: './wash-manual-appointment-selection.page.html',
  styleUrl: './wash-manual-appointment-selection.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashManualAppointmentSelectionPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly supervision = inject(WashEntrySupervisionUseCase);

  readonly appointments = signal<SupervisorManualAppointments | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  select(appointment: SupervisorManualAppointment): void {
    const destination = this.destinationFor(appointment);
    const serviceDate = this.appointments()?.serviceDate;
    if (!destination || !serviceDate) {
      return;
    }

    void this.router.navigate([destination], {
      state: { supervisorLookup: this.toLookup(appointment, serviceDate) },
    });
  }

  statusLabel(appointment: SupervisorManualAppointment): string {
    return appointment.manualSelectionStatus === 'REGISTERED' ? 'Registrada' : 'En proceso';
  }

  actionLabel(appointment: SupervisorManualAppointment): string {
    return appointment.nextAction === 'EXIT_REVIEW' ? 'Continuar a salida' : 'Continuar a ingreso';
  }

  formatServiceDate(serviceDate: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Mexico_City',
    }).format(new Date(`${serviceDate}T12:00:00-06:00`));
  }

  formatTimeSlot(appointment: SupervisorManualAppointment): string {
    const { startsAt, endsAt, timezone } = appointment.appointment.appointmentTimeSlot;
    const formatter = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone: timezone,
    });
    return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.supervision
      .getManualAppointments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointments) => {
          this.appointments.set(appointments);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible cargar las citas del día.',
          );
          this.loading.set(false);
        },
      });
  }

  private destinationFor(appointment: SupervisorManualAppointment): string | null {
    switch (appointment.nextAction) {
      case 'ENTRY':
        return '/wash/supervision/entry';
      case 'ENTRY_DECISION':
        return '/wash/supervision/entry/validation';
      case 'EXIT_REVIEW':
        return '/wash/supervision/exit/review';
      default:
        return null;
    }
  }

  private toLookup(
    appointment: SupervisorManualAppointment,
    serviceDate: string,
  ): SupervisorLookup {
    return { serviceDate, ...appointment };
  }
}
