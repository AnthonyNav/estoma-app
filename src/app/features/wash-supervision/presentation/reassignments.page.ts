import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { interval, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { ApplicationError } from '../../../core/api/application-error';
import { REASSIGNMENT_GATEWAY } from '../domain/ports/reassignment.gateway';
import {
  candidateKey,
  canReassign,
  PendingReassignment,
  ReassignmentCandidate,
  ReassignmentCandidates,
} from '../domain/models/reassignment';
import { ReassignmentWorkflowService } from '../application/reassignment-workflow.service';
@Component({
  selector: 'app-reassignments-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './reassignments.page.html',
  styleUrl: './reassignments.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReassignmentsPage {
  private readonly api = inject(REASSIGNMENT_GATEWAY);
  private readonly destroy = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  readonly flow = inject(ReassignmentWorkflowService);
  readonly rows = signal<PendingReassignment[]>([]);
  readonly loading = signal(false);
  readonly listError = signal(false);
  readonly active = signal<PendingReassignment | null>(null);
  readonly snapshot = signal<ReassignmentCandidates | null>(null);
  readonly checking = signal(false);
  readonly unavailable = signal(false);
  readonly selection = signal<string | null>(null);
  readonly notice = signal('');
  readonly isDemo = environment.useMockApi;
  readonly canReassign = canReassign;
  readonly key = candidateKey;
  readonly choice = computed(
    () => this.snapshot()?.candidates.find((c) => candidateKey(c) === this.selection()) ?? null,
  );
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('cancelDialog');
  reason = '';
  reasonError = false;
  private generation = 0;
  private nextRefresh = 0;
  private failures = 0;
  constructor() {
    this.load();
    if (this.flow.pending()) void this.flow.resume();
    interval(1000)
      .pipe(takeUntilDestroyed(), takeUntil(this.lifecycle.ended$))
      .subscribe(() => {
        if (
          document.visibilityState !== 'visible' ||
          this.flow.busy() ||
          this.flow.pending() ||
          this.flow.completed() ||
          Date.now() < this.nextRefresh
        )
          return;
        if (this.active()) this.refreshCandidates();
        else if (!this.loading()) this.load();
      });
    effect(() => {
      if (this.flow.error() && !this.flow.pending() && !this.flow.busy()) {
        this.selection.set(null);
        this.snapshot.set(null);
        this.active.set(null);
        untracked(() => this.load());
      }
    });
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.listError.set(false);
    this.nextRefresh = Date.now() + 15000;
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroy), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.listError.set(true);
          this.loading.set(false);
        },
      });
  }
  open(row: PendingReassignment): void {
    if (!canReassign(row) || this.flow.pending() || this.flow.busy()) return;
    this.flow.reset();
    this.generation++;
    this.active.set(row);
    this.selection.set(null);
    this.snapshot.set(null);
    this.notice.set('');
    this.unavailable.set(false);
    this.checking.set(false);
    this.failures = 0;
    this.refreshCandidates();
  }
  back(): void {
    if (this.flow.busy() || this.flow.pending()) return;
    this.generation++;
    this.active.set(null);
    this.snapshot.set(null);
    this.selection.set(null);
    this.flow.reset();
    this.load();
  }
  refreshCandidates(): void {
    const row = this.active();
    if (!row || this.checking() || this.flow.busy() || this.flow.pending()) return;
    const generation = this.generation;
    this.checking.set(true);
    this.nextRefresh = Date.now() + 5000;
    this.api
      .candidates(row.washExecutionId)
      .pipe(takeUntilDestroyed(this.destroy), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (value) => {
          if (generation !== this.generation) return;
          this.checking.set(false);
          this.failures = 0;
          if (value.executionVersion !== row.executionVersion) {
            this.notice.set(
              'La atención cambió. Vuelve a seleccionar al alumno para consultar su estado actualizado.',
            );
            this.unavailable.set(true);
            this.snapshot.set(null);
            this.selection.set(null);
            this.nextRefresh = Date.now() + 15000;
            this.load();
            return;
          }
          this.unavailable.set(false);
          this.snapshot.set(value);
          if (
            this.selection() &&
            !value.candidates.some((c) => candidateKey(c) === this.selection())
          ) {
            this.selection.set(null);
            this.notice.set(
              'El espacio que seleccionaste ya no está disponible. Elige otra opción.',
            );
          }
        },
        error: (error: unknown) => {
          if (generation !== this.generation) return;
          this.checking.set(false);
          this.unavailable.set(true);
          this.snapshot.set(null);
          this.selection.set(null);
          this.failures++;
          this.nextRefresh =
            Date.now() +
            Math.max(
              error instanceof ApplicationError ? (error.retryAfterMs ?? 0) : 0,
              Math.min(60000, 5000 * 2 ** this.failures),
            );
        },
      });
  }
  select(candidate: ReassignmentCandidate): void {
    this.selection.set(candidateKey(candidate));
    this.notice.set('');
  }
  confirm(): void {
    if (!this.fresh() || !this.choice() || !this.active()) return;
    this.flow.start(this.active()!, this.choice());
  }
  private fresh(): boolean {
    if (this.unavailable() || this.checking() || !this.snapshot()) return false;
    const age = Date.now() - Date.parse(this.snapshot()!.snapshotGeneratedAt);
    if (age < 0 || age > 10000) {
      this.notice.set(
        'Estamos actualizando la disponibilidad. Revisa tu selección y confirma de nuevo.',
      );
      this.refreshCandidates();
      return false;
    }
    return true;
  }
  openCancel(): void {
    if (!this.fresh() || this.snapshot()!.candidates.length) return;
    this.reason = '';
    this.reasonError = false;
    this.dialog()?.nativeElement.showModal();
  }
  cancel(): void {
    this.reasonError = !this.reason.trim() || this.reason.trim().length > 500;
    if (this.reasonError) return;
    if (!this.fresh() || this.snapshot()!.candidates.length || !this.active()) {
      this.dialog()?.nativeElement.close();
      return;
    }
    this.dialog()?.nativeElement.close();
    this.flow.start(this.active()!, null, this.reason);
  }
  type(type: string | undefined): string {
    return type === 'NORMAL'
      ? 'Normal'
      : type === 'JOURNEY'
        ? 'Jornada'
        : type === 'IMMUNOCOMPROMISED'
          ? 'Inmunocomprometido'
          : (type ?? 'Sin información');
  }
  slot(row: PendingReassignment): string {
    const slot = row.appointment?.appointmentTimeSlot;
    if (!slot) return 'Horario no disponible';
    try {
      const date = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
        timeZone: slot.timezone,
      });
      const time = new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: slot.timezone,
      });
      return `${date.format(new Date(slot.startsAt))} · ${time.format(new Date(slot.startsAt))} – ${time.format(new Date(slot.endsAt))}`;
    } catch {
      return 'Horario no disponible';
    }
  }
}
