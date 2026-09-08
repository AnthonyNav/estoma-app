import { SupervisorExitPage } from '../../wash-exit/presentation/supervisor-exit.page';
import { EntryApprovedComponent } from './entry-approved.component';
import { Router, RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';

@Component({
  selector: 'app-wash-entry-supervision-page',
  imports: [RouterLink, EntryApprovedComponent, SupervisorExitPage],
  templateUrl: './wash-entry-supervision.page.html',
  styleUrl: './wash-entry-supervision.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashEntrySupervisionPage {
  private readonly router = inject(Router);
  readonly flow = inject(SupervisorEntryWorkflowService);
  readonly exitReview = computed(
    () => this.flow.lookup()?.nextAction === 'EXIT_REVIEW' && !this.flow.authorizedHere?.(),
  );
  readonly backRoute =
    inject(Router).getCurrentNavigation()?.extras.state?.['from'] === 'scan'
      ? '/wash/supervision/scan'
      : '/wash/supervision/manual';
  readonly verifying = computed(
    () =>
      ['ENTRY', 'ENTRY_DECISION'].includes(this.flow.lookup()?.nextAction ?? '') &&
      ['SCHEDULED', 'PENDING_ENTRY'].includes(this.status()),
  );
  readonly rejectionReason = signal('');
  readonly rejectionTouched = signal(false);
  readonly status = computed(
    () =>
      this.flow.lookup()?.washExecution?.status ??
      this.flow.lookup()?.appointment.appointmentStatus ??
      'NONE',
  );
  readonly heading = computed(
    () =>
      ({
        PENDING_ENTRY: 'Verifica antes de aprobar',
        IN_PROGRESS: 'Ingreso autorizado',
        ENTRY_REJECTED: 'Ingreso rechazado',
        PENDING_REASSIGNMENT: 'Ingreso autorizado · sin espacio disponible',
        CANCELLED: 'Atención cancelada',
        COMPLETED: 'Atención finalizada',
        EXIT_SUBMITTED: 'Salida pendiente de revisión',
        SCHEDULED: 'El alumno aún no registra su llegada',
        MISSED: 'Cita marcada como inasistencia',
        NONE: 'Consulta el estado de la cita',
      })[this.status()],
  );
  constructor() {
    if (this.flow.pending?.()) this.flow.resume();
  }
  @ViewChild('decisionDialog') private dialog?: ElementRef<HTMLDialogElement>;
  private trigger: HTMLElement | null = null;
  finishAttention(destination: 'scan' | 'home'): void {
    if (this.flow.busy() || this.flow.pending() || this.status() !== 'IN_PROGRESS') return;
    this.flow.reset();
    void this.router.navigate([
      destination === 'scan' ? '/wash/supervision/scan' : '/wash/supervision',
    ]);
  }
  setReason(event: Event): void {
    this.rejectionReason.set((event.target as HTMLTextAreaElement).value);
  }
  openDecision(decision: 'AUTHORIZED' | 'REJECTED', event: MouseEvent): void {
    if (!this.flow.canStartDecision()) return;
    if (decision === 'AUTHORIZED') {
      this.flow.decide('AUTHORIZED', true, true, '');
      return;
    }
    this.rejectionReason.set('');
    this.rejectionTouched.set(false);
    this.trigger = event.currentTarget as HTMLElement;
    this.dialog?.nativeElement.showModal();
  }
  closeDialog(): void {
    this.dialog?.nativeElement.close();
  }
  restoreFocus(): void {
    this.trigger?.focus();
    this.trigger = null;
  }
  confirmDecision(): void {
    const reason = this.rejectionReason().trim();
    if (!reason || reason.length > 500) {
      this.rejectionTouched.set(true);
      return;
    }
    if (!this.flow.canStartDecision()) return;
    this.closeDialog();
    // The workflow omits both checks for an unclassified rejection.
    this.flow.decide('REJECTED', false, false, reason);
  }
  formatSlot(): string {
    const slot = this.flow.lookup()?.appointment.appointmentTimeSlot;
    if (!slot) return '';
    try {
      const time = new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: slot.timezone,
      });
      const day = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
        timeZone: slot.timezone,
      });
      return `${day.format(new Date(slot.startsAt))} · ${time.format(new Date(slot.startsAt))}–${time.format(new Date(slot.endsAt))}`;
    } catch {
      return 'Horario no disponible';
    }
  }
  typeLabel(): string {
    return {
      NORMAL: 'Normal',
      JOURNEY: 'Jornada clínica',
      IMMUNOCOMPROMISED: 'Inmunocomprometido',
    }[this.flow.lookup()!.appointment.appointmentType];
  }
  pieceLabel(): string {
    return {
      HIGH_SPEED: 'Alta velocidad',
      LOW_SPEED: 'Baja velocidad',
      CONTRA_ANGLE: 'Contra-ángulo',
    }[this.flow.lookup()!.appointment.pieceType];
  }
}
