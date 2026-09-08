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
import { Router, RouterLink } from '@angular/router';
import { interval, takeUntil } from 'rxjs';
import { STUDENT_WASH_HOME_GATEWAY } from '../../wash-student-home/domain/ports/student-wash-home.gateway';
import { StudentWashHome } from '../../wash-student-home/domain/models/student-wash-home';
import { StudentExitService } from '../application/student-exit.service';
import {
  emptyMaterials,
  ExitMaterials,
  materialFields,
  validMaterials,
} from '../domain/student-exit';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';
@Component({
  selector: 'app-student-exit-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './student-exit.page.html',
  styleUrl: './student-exit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentExitPage {
  readonly flow = inject(StudentExitService);
  private readonly api = inject(STUDENT_WASH_HOME_GATEWAY);
  private readonly destroy = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  readonly home = signal<StudentWashHome | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly fields = materialFields;
  readonly materials = signal<ExitMaterials>(emptyMaterials());
  readonly touched = signal(false);
  readonly valid = computed(() => validMaterials(this.materials()));
  readonly canEdit = computed(
    () =>
      this.home()?.appointment?.washExecution?.status === 'IN_PROGRESS' &&
      !this.flow.pending() &&
      !this.flow.busy() &&
      !this.failed() &&
      !this.flow.error(),
  );
  constructor() {
    this.load();
    if (this.flow.pending()) void this.flow.resume();
    effect(() => {
      const home = this.flow.settled();
      if (home) {
        untracked(() => {
          this.home.set(home);
          this.clearDraft();
        });
      }
    });
    interval(5000)
      .pipe(takeUntilDestroyed(), takeUntil(this.lifecycle.ended$))
      .subscribe(() => {
        if (
          document.visibilityState === 'visible' &&
          this.home()?.appointment?.washExecution?.status === 'EXIT_SUBMITTED' &&
          !this.flow.pending()
        )
          this.load();
      });
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .loadHome()
      .pipe(takeUntilDestroyed(this.destroy), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.loading.set(false);
          if (!this.flow.pending()) this.flow.error.set(null);
          this.restoreDraft();
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
  private draftKey(): string {
    return `estoma.exit.draft.${this.session.session()?.accountId}.${this.home()?.appointment?.washExecution?.washExecutionId}`;
  }
  private restoreDraft(): void {
    if (!this.canEdit()) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.draftKey()) ?? 'null');
      if (
        saved &&
        this.fields.every(
          (f) => Number.isInteger(saved[f.key]) && saved[f.key] >= 0 && saved[f.key] <= 2147483647,
        )
      )
        this.materials.set(saved);
    } catch {
      /* Use the current draft. */
    }
  }
  private clearDraft(): void {
    try {
      sessionStorage.removeItem(this.draftKey());
    } catch {
      /* No pending command is stored here. */
    }
  }
  change(key: keyof ExitMaterials, value: number | null): void {
    if (!this.canEdit()) return;
    this.materials.update((m) => ({ ...m, [key]: value as number }));
    try {
      sessionStorage.setItem(this.draftKey(), JSON.stringify(this.materials()));
    } catch {
      /* Pending requests require storage separately. */
    }
  }
  step(key: keyof ExitMaterials, delta: number): void {
    this.change(key, Math.max(0, Math.min(2147483647, (this.materials()[key] ?? 0) + delta)));
  }
  submit(): void {
    this.touched.set(true);
    if (this.canEdit() && this.valid() && this.home())
      this.flow.start(this.home()!, this.materials());
  }
  invalid(key: keyof ExitMaterials): boolean {
    const v = this.materials()[key];
    return !Number.isInteger(v) || v < 0 || v > 2147483647;
  }
  async showQr(): Promise<void> {
    await this.router.navigate(['/wash/student']);
  }
}
