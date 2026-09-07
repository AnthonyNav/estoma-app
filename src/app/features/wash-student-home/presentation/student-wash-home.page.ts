import {
  effect,
  untracked,
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
import { timer } from 'rxjs';
import { AppointmentCancellationService } from '../../wash-appointments/application/appointment-cancellation.service';
import { environment } from '../../../../environments/environment';
import { AppointmentRegistrationDraftService } from '../../wash-appointments/presentation/appointment-registration-draft.service';
import { RouterLink } from '@angular/router';

import { ApplicationError, ApplicationErrorKind } from '../../../core/api/application-error';
import { LoadStudentWashHomeUseCase } from '../application/load-student-wash-home.use-case';
import {
  AppointmentType,
  PieceType,
  StudentWashAppointment,
  StudentWashHome,
  WashExecutionStatus,
} from '../domain/models/student-wash-home';
import { NoAppointmentComponent } from './components/no-appointment.component';
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
  imports: [AppointmentQrComponent, NoAppointmentComponent, RouterLink],
  templateUrl: './student-wash-home.page.html',
  styleUrl: './student-wash-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentWashHomePage {
  readonly cancellation = inject(AppointmentCancellationService);
  readonly canCancel = computed(() => {
    const appointment = this.home()?.appointment;
    return (
      !this.registration.pendingSchedule() &&
      !this.cancellation.pending() &&
      appointment?.appointmentStatus === 'SCHEDULED' &&
      appointment.studentCancellationAction === 'AVAILABLE' &&
      Number.isInteger(appointment.appointmentVersion) &&
      (appointment.appointmentVersion ?? 0) > 0
    );
  });
  @ViewChild('cancelDialog') private cancelDialog?: ElementRef<HTMLDialogElement>;
  private cancelTrigger: HTMLElement | null = null;

  readonly demoQr = environment.useMockWashBooking;
  readonly registration = inject(AppointmentRegistrationDraftService);
  readonly synchronizing = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadStudentWashHome = inject(LoadStudentWashHomeUseCase);

  @ViewChild('qrDialog') private qrDialog?: ElementRef<HTMLDialogElement>;
  private qrTrigger: HTMLElement | null = null;

  readonly home = signal<StudentWashHome | null>(null);
  readonly showQr = computed(() => {
    const appointment = this.home()?.appointment;
    const status = appointment?.washExecution?.status ?? appointment?.appointmentStatus;
    return !!appointment?.qrRepresentation && status !== 'IN_PROGRESS';
  });
  readonly errorKind = signal<ApplicationErrorKind | null>(null);
  readonly loading = signal(true);
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
  readonly presentation = computed<StatusPresentation | null>(() => {
    const appointment = this.home()?.appointment;
    return appointment ? this.presentAppointment(appointment) : null;
  });

  constructor() {
    effect(() => {
      if (this.cancellation.settled()) untracked(() => this.load());
    });
    this.load();
  }

  retry(): void {
    this.load();
  }

  openCancellation(event: MouseEvent): void {
    if (!this.canCancel()) return;
    this.cancelTrigger = event.currentTarget as HTMLElement;
    this.cancelDialog?.nativeElement.showModal();
  }
  closeCancellation(): void {
    this.cancelDialog?.nativeElement.close();
  }
  restoreCancelFocus(): void {
    this.cancelTrigger?.focus();
    this.cancelTrigger = null;
  }
  confirmCancellation(): void {
    const appointment = this.home()?.appointment;
    if (!this.canCancel() || !appointment?.appointmentVersion) return;
    this.closeCancellation();
    this.cancellation.start(appointment.appointmentId, appointment.appointmentVersion);
  }
  qrInstruction(appointment: StudentWashAppointment): string {
    if (this.demoQr) return 'Vista de prueba. No es válido para ingresar al área de Lavado.';
    const labels = {
      NONE: 'Tu código está disponible. Su uso se habilitará cuando corresponda a tu atención.',
      ENTRY: 'Presenta este código al llegar.',
      STUDENT_EXIT: 'Al terminar, registra tus materiales antes de acudir a revisión.',
      SUPERVISOR_EXIT_REVIEW: 'Presenta este código para la revisión de salida.',
    };
    return labels[appointment.qrUsageContext];
  }

  openQr(event: MouseEvent): void {
    if (!this.showQr()) return;
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
    const slot = appointment.timeSlot;
    if (!slot?.startsAt || !slot.endsAt) return 'Horario no disponible';
    try {
      const formatter = new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: slot.timezone || 'America/Mexico_City',
      });
      return `${formatter.format(new Date(slot.startsAt))}–${formatter.format(new Date(slot.endsAt))}`;
    } catch {
      return 'Horario no disponible';
    }
  }

  appointmentTypeLabel(appointmentType: AppointmentType): string {
    const labels: Record<AppointmentType, string> = {
      NORMAL: 'Normal',
      JOURNEY: 'Jornada',
      IMMUNOCOMPROMISED: 'Inmunocomprometido',
    };

    return labels[appointmentType];
  }

  pieceTypeLabel(pieceType: PieceType | null | undefined): string {
    const labels: Record<PieceType, string> = {
      HIGH_SPEED: 'Alta velocidad',
      LOW_SPEED: 'Baja velocidad',
      CONTRA_ANGLE: 'Contra-ángulo',
    };

    return pieceType ? labels[pieceType] : 'No disponible';
  }

  private load(attempt = 0): void {
    this.loading.set(true);
    this.errorKind.set(null);

    this.loadStudentWashHome
      .execute()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          const cancellation = this.cancellation.pending();
          if (cancellation?.result?.status === 'SUCCEEDED') {
            if (
              !home.appointment ||
              (home.appointment.appointmentId === cancellation.command.appointmentId &&
                home.appointment.appointmentStatus === 'CANCELLED')
            ) {
              this.cancellation.clear();
              this.synchronizing.set(false);
            } else if (attempt < 19) {
              this.synchronizing.set(true);
              timer(1500)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(() => this.load(attempt + 1));
            } else this.synchronizing.set(false);
          }
          const pending = this.registration.pendingSchedule();
          if (pending?.result?.status === 'SUCCEEDED') {
            if (home.appointment?.appointmentId === pending.result.data?.aggregateId) {
              this.registration.reset();
              this.synchronizing.set(false);
            } else if (attempt < 19) {
              this.synchronizing.set(true);
              timer(1500)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(() => this.load(attempt + 1));
            } else this.synchronizing.set(false);
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.synchronizing.set(false);
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
          tone: 'success',
          label: 'Cita registrada',
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
          qrLabel: null,
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
        qrLabel: null,
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
}
