import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApplicationError, ApplicationErrorKind } from '../../../core/api/application-error';
import { LoadStudentWashHomeUseCase } from '../application/load-student-wash-home.use-case';
import { ManageStudentWashLifecycleUseCase } from '../application/manage-student-wash-lifecycle.use-case';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import {
  AppointmentType,
  PieceType,
  StudentWashAppointment,
  StudentWashHome,
  WashExecutionStatus,
} from '../domain/models/student-wash-home';
import { AppointmentQrComponent } from './components/appointment-qr.component';

type HomeState =
  | 'LOADING'
  | 'NO_APPOINTMENT'
  | 'APPOINTMENT_AVAILABLE'
  | 'TEMPORARY_UNAVAILABLE'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'OFFLINE';

type StatusTone = 'calm' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatusPresentation {
  tone: StatusTone;
  label: string;
  title: string;
  description: string;
  qrLabel: string | null;
}

@Component({
  selector: 'app-student-wash-home-page',
  imports: [AppointmentQrComponent, RouterLink],
  templateUrl: './student-wash-home.page.html',
  styleUrl: './student-wash-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentWashHomePage {
  private readonly loadStudentWashHome = inject(LoadStudentWashHomeUseCase);
  private readonly lifecycle = inject(ManageStudentWashLifecycleUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  @ViewChild('qrDialog') private qrDialog?: ElementRef<HTMLDialogElement>;
  private qrTrigger: HTMLElement | null = null;

  readonly home = signal<StudentWashHome | null>(null);
  readonly errorKind = signal<ApplicationErrorKind | null>(null);
  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly cancellationError = signal<string | null>(null);
  readonly state = computed<HomeState>(() => {
    if (this.loading()) {
      return 'LOADING';
    }

    const errorKind = this.errorKind();
    if (errorKind === 'authentication') {
      return 'AUTHENTICATION';
    }
    if (errorKind === 'forbidden') {
      return 'FORBIDDEN';
    }
    if (errorKind === 'network') {
      return 'OFFLINE';
    }
    if (errorKind) {
      return 'TEMPORARY_UNAVAILABLE';
    }

    return this.home()?.appointment ? 'APPOINTMENT_AVAILABLE' : 'NO_APPOINTMENT';
  });
  readonly presentation = computed<StatusPresentation>(() => {
    const appointment = this.home()?.appointment;
    return appointment ? this.presentAppointment(appointment) : this.noAppointmentPresentation;
  });
  readonly mayCancelAppointment = computed(
    () => this.home()?.appointment?.studentCancellationAction === 'AVAILABLE' && !this.cancelling(),
  );
  readonly mayRegisterExit = computed(
    () => this.home()?.appointment?.washExecution?.status === 'IN_PROGRESS',
  );

  private readonly noAppointmentPresentation: StatusPresentation = {
    tone: 'calm',
    label: 'Tu cita de Lavado',
    title: 'No tienes cita registrada hoy',
    description:
      'Mantén al día tus procedimientos clínicos registrando una cita de lavado ultrasónico.',
    qrLabel: null,
  };

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  cancelAppointment(): void {
    const appointment = this.home()?.appointment;
    if (
      !appointment ||
      appointment.studentCancellationAction !== 'AVAILABLE' ||
      this.cancelling()
    ) {
      return;
    }

    this.cancelling.set(true);
    this.cancellationError.set(null);
    this.lifecycle
      .cancelAppointment({
        appointmentId: appointment.appointmentId,
        expectedVersion: appointment.appointmentVersion ?? 1,
        idempotencyKey: this.createIdempotencyKey(),
      })
      .subscribe({
        next: (accepted) =>
          this.operationTracker
            .trackAccepted(accepted, () => this.lifecycle.getOperation(accepted.operationId))
            .subscribe({
              next: (operation) => {
                this.cancelling.set(false);
                if (operation.status === 'SUCCEEDED') {
                  this.load();
                  return;
                }
                this.cancellationError.set(
                  'No fue posible cancelar la cita. Actualiza el estado e inténtalo de nuevo.',
                );
              },
              error: () => {
                this.cancelling.set(false);
                this.cancellationError.set(
                  'No pudimos comprobar la cancelación. Actualiza el estado antes de reintentar.',
                );
              },
            }),
        error: (error: unknown) => {
          this.cancelling.set(false);
          this.cancellationError.set(
            error instanceof ApplicationError ? error.message : 'No fue posible cancelar la cita.',
          );
        },
      });
  }

  openQr(event: MouseEvent): void {
    this.qrTrigger = event.currentTarget as HTMLElement;
    const dialog = this.qrDialog?.nativeElement;
    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
  }

  closeQr(): void {
    const dialog = this.qrDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
  }

  restoreQrFocus(): void {
    this.qrTrigger?.focus();
    this.qrTrigger = null;
  }

  formatTimeSlot(appointment: StudentWashAppointment): string {
    const formatter = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      timeZone: appointment.timeSlot.timezone,
    });
    return `${formatter.format(new Date(appointment.timeSlot.startsAt))}–${formatter.format(
      new Date(appointment.timeSlot.endsAt),
    )}`;
  }

  appointmentTypeLabel(appointmentType: AppointmentType): string {
    const labels: Record<AppointmentType, string> = {
      NORMAL: 'Normal',
      JOURNEY: 'Jornada',
      IMMUNOCOMPROMISED: 'Inmunocomprometido',
    };

    return labels[appointmentType];
  }

  pieceTypeLabel(pieceType: PieceType): string {
    const labels: Record<PieceType, string> = {
      HIGH_SPEED: 'Alta velocidad',
      LOW_SPEED: 'Baja velocidad',
      CONTRA_ANGLE: 'Contra-ángulo',
    };

    return labels[pieceType];
  }

  private load(): void {
    this.loading.set(true);
    this.errorKind.set(null);

    this.loadStudentWashHome.execute().subscribe({
      next: (home) => {
        this.home.set(home);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.home.set(null);
        this.errorKind.set(error instanceof ApplicationError ? error.kind : 'unknown');
        this.loading.set(false);
      },
    });
  }

  private presentAppointment(appointment: StudentWashAppointment): StatusPresentation {
    const executionStatus = appointment.washExecution?.status;

    if (executionStatus) {
      return this.presentExecution(executionStatus, appointment.qrRepresentation !== null);
    }

    switch (appointment.appointmentStatus) {
      case 'SCHEDULED':
        return {
          tone: 'info',
          label: 'Cita programada',
          title: 'Tu cita está lista',
          description: 'La cabina se asignará cuando el Supervisor apruebe tu ingreso.',
          qrLabel:
            appointment.qrUsageContext === 'ENTRY' ? 'Presenta este código al llegar.' : null,
        };
      case 'CANCELLED':
        return {
          tone: 'neutral',
          label: 'Cita cancelada',
          title: 'Tu cita fue cancelada',
          description: 'Consulta con tu docente o registra una nueva cita cuando corresponda.',
          qrLabel: null,
        };
      case 'MISSED':
        return {
          tone: 'warning',
          label: 'Inasistencia',
          title: 'La cita se marcó como inasistencia',
          description: 'Si necesitas apoyo, consulta con el área de Lavado.',
          qrLabel: null,
        };
      case 'ENTRY_REJECTED':
        return {
          tone: 'danger',
          label: 'Ingreso rechazado',
          title: 'No fue posible realizar tu atención',
          description: 'Consulta el motivo registrado por el Supervisor.',
          qrLabel: null,
        };
      case 'IN_PROGRESS':
        return {
          tone: 'success',
          label: 'Lavado en proceso',
          title: 'Tu lavado está en proceso',
          description: 'Sigue las indicaciones del personal de Lavado.',
          qrLabel: appointment.qrRepresentation ? 'Código disponible para tu salida.' : null,
        };
      case 'COMPLETED':
        return {
          tone: 'success',
          label: 'Lavado finalizado',
          title: 'Tu lavado se completó',
          description: 'Tu atención de hoy ha concluido.',
          qrLabel: null,
        };
    }
  }

  private presentExecution(
    executionStatus: WashExecutionStatus,
    hasQrRepresentation: boolean,
  ): StatusPresentation {
    const presentations: Record<WashExecutionStatus, StatusPresentation> = {
      PENDING_ENTRY: {
        tone: 'warning',
        label: 'Llegada registrada',
        title: 'Esperando validación',
        description: 'El Supervisor revisará tu ingreso en un momento.',
        qrLabel: null,
      },
      ENTRY_REJECTED: {
        tone: 'danger',
        label: 'Ingreso rechazado',
        title: 'No fue posible realizar tu atención',
        description: 'Consulta el motivo registrado por el Supervisor.',
        qrLabel: null,
      },
      PENDING_REASSIGNMENT: {
        tone: 'info',
        label: 'Ingreso autorizado',
        title: 'Estamos asignando tu espacio',
        description: 'Espera las indicaciones del Supervisor.',
        qrLabel: null,
      },
      IN_PROGRESS: {
        tone: 'success',
        label: 'Lavado en proceso',
        title: 'Tu lavado está en proceso',
        description: 'Sigue las indicaciones del personal de Lavado.',
        qrLabel: hasQrRepresentation ? 'Código disponible para tu salida.' : null,
      },
      EXIT_SUBMITTED: {
        tone: 'info',
        label: 'Salida registrada',
        title: 'Esperando revisión de salida',
        description: 'El personal de Lavado confirmará el cierre de tu atención.',
        qrLabel: hasQrRepresentation ? 'Código disponible para la revisión.' : null,
      },
      COMPLETED: {
        tone: 'success',
        label: 'Lavado finalizado',
        title: 'Tu lavado se completó',
        description: 'Tu atención de hoy ha concluido.',
        qrLabel: null,
      },
      CANCELLED: {
        tone: 'neutral',
        label: 'Atención cancelada',
        title: 'Tu atención fue cancelada',
        description: 'Consulta con el área de Lavado si necesitas orientación.',
        qrLabel: null,
      },
    };

    return presentations[executionStatus];
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `wash-cancel-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
