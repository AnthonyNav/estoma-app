import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, takeUntil } from 'rxjs';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SupervisorEntryWorkflowService } from '../../wash-supervision/application/supervisor-entry-workflow.service';
import { WASH_SUPERVISION_GATEWAY } from '../../wash-supervision/domain/ports/wash-supervision.gateway';
import { SupervisorExitService } from '../application/supervisor-exit.service';
import { canCompleteExit } from '../domain/supervisor-exit';
import {
  emptyMaterials,
  ExitMaterials,
  materialFields,
  validMaterials,
} from '../domain/student-exit';
@Component({
  selector: 'app-supervisor-exit-page',
  imports: [FormsModule],
  templateUrl: './supervisor-exit.page.html',
  styleUrl: './supervisor-exit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorExitPage {
  readonly flow = inject(SupervisorExitService);
  readonly entry = inject(SupervisorEntryWorkflowService);
  private readonly api = inject(WASH_SUPERVISION_GATEWAY);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly session = inject(SessionStore);
  readonly fields = materialFields;
  readonly values = signal<ExitMaterials>(emptyMaterials());
  readonly touched = signal(false);
  readonly refreshing = signal(false);
  readonly readError = signal('');
  readonly lookup = this.entry.lookup;
  readonly ready = computed(() => canCompleteExit(this.lookup()));
  readonly canSubmit = computed(
    () =>
      this.ready() &&
      validMaterials(this.values()) &&
      !this.refreshing() &&
      !this.flow.pending() &&
      !this.flow.busy() &&
      !this.flow.error() &&
      !this.readError(),
  );
  constructor() {
    effect(() => {
      const lookup = this.lookup();
      if (
        lookup?.washExecution?.status === 'EXIT_SUBMITTED' &&
        validMaterials(lookup.washExecution.submittedExitMaterials)
      )
        untracked(() => {
          this.values.set(structuredClone(lookup.washExecution!.submittedExitMaterials!));
          try {
            const draft = JSON.parse(sessionStorage.getItem(this.draftKey()) ?? 'null');
            if (
              draft?.version === lookup.washExecution!.executionVersion &&
              validMaterials(draft.values)
            )
              this.values.set(draft.values);
          } catch {
            /* Keep submitted materials. */
          }
        });
    });
    if (this.flow.pending()) void this.flow.resume();
    interval(5000)
      .pipe(takeUntilDestroyed(), takeUntil(this.lifecycle.ended$))
      .subscribe(() => {
        if (
          document.visibilityState === 'visible' &&
          this.lookup()?.washExecution?.status === 'IN_PROGRESS' &&
          !this.flow.pending() &&
          !this.flow.settled()
        )
          this.refresh();
      });
  }
  private draftKey() {
    return `estoma.exit.review.${this.session.session()?.accountId}.${this.lookup()?.washExecution?.washExecutionId}`;
  }
  change(key: keyof ExitMaterials, value: number | null) {
    if (!this.ready() || this.flow.pending() || this.flow.busy()) return;
    this.values.update((v) => ({ ...v, [key]: value as number }));
    try {
      sessionStorage.setItem(
        this.draftKey(),
        JSON.stringify({
          version: this.lookup()?.washExecution?.executionVersion,
          values: this.values(),
        }),
      );
    } catch {
      /* Pending requests are saved separately. */
    }
  }
  step(key: keyof ExitMaterials, delta: number) {
    this.change(key, Math.max(0, Math.min(2147483647, (this.values()[key] ?? 0) + delta)));
  }
  original(key: keyof ExitMaterials) {
    return this.lookup()?.washExecution?.submittedExitMaterials?.[key];
  }
  changed(key: keyof ExitMaterials) {
    return this.original(key) !== this.values()[key];
  }
  invalid(key: keyof ExitMaterials) {
    const value = this.values()[key];
    return !Number.isInteger(value) || value < 0 || value > 2147483647;
  }
  submit() {
    this.touched.set(true);
    if (this.canSubmit() && this.lookup()) this.flow.start(this.lookup()!, this.values());
  }
  refresh() {
    const previous = this.lookup();
    if (!previous || this.refreshing() || this.flow.pending() || this.flow.busy()) return;
    this.refreshing.set(true);
    this.readError.set('');
    this.api
      .lookup({
        lookupType: 'STUDENT_ENROLLMENT',
        studentEnrollment: previous.student.studentEnrollment,
      })
      .pipe(takeUntilDestroyed(this.destroy), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (next) => {
          this.refreshing.set(false);
          if (
            next.appointment.appointmentId !== previous.appointment.appointmentId ||
            next.washExecution?.washExecutionId !== previous.washExecution?.washExecutionId
          ) {
            this.readError.set(
              'La búsqueda ya no devuelve esta cita. Regresa a búsqueda manual para revisar la atención correcta.',
            );
            return;
          }
          this.entry.lookup.set(next);
          this.flow.error.set(null);
        },
        error: () => {
          this.refreshing.set(false);
          this.readError.set('No pudimos consultar esta atención. Intenta nuevamente.');
        },
      });
  }
  next(destination: 'scan' | 'manual' | 'home') {
    if (this.flow.busy() || this.flow.pending()) return;
    try {
      sessionStorage.removeItem(this.draftKey());
    } catch {
      /* No pending operation is removed. */
    }
    this.flow.reset();
    this.entry.reset();
    void this.router.navigate([
      destination === 'home' ? '/wash/supervision' : `/wash/supervision/${destination}`,
    ]);
  }
}
