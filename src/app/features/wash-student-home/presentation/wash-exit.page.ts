import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { LoadStudentWashHomeUseCase } from '../application/load-student-wash-home.use-case';
import { ManageStudentWashLifecycleUseCase } from '../application/manage-student-wash-lifecycle.use-case';
import { StudentWashHome } from '../domain/models/student-wash-home';

@Component({
  selector: 'app-wash-exit-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-exit.page.html',
  styleUrl: './wash-exit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashExitPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly loadHome = inject(LoadStudentWashHomeUseCase);
  private readonly lifecycle = inject(ManageStudentWashLifecycleUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  readonly form = this.formBuilder.nonNullable.group({
    packageCount: [0, [Validators.required, Validators.min(0)]],
    greenPaperCassette8Count: [0, [Validators.required, Validators.min(0)]],
    greenPaperCassette10Count: [0, [Validators.required, Validators.min(0)]],
    witnessTapePortionCount: [0, [Validators.required, Validators.min(0)]],
  });
  readonly home = signal<StudentWashHome | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasAtLeastOneMaterial = computed(() =>
    Object.values(this.form.getRawValue()).some((value) => value > 0),
  );
  readonly maySubmit = computed(
    () =>
      !this.loading() &&
      !this.submitting() &&
      this.home()?.appointment?.washExecution?.status === 'IN_PROGRESS' &&
      this.form.valid &&
      this.hasAtLeastOneMaterial(),
  );

  constructor() {
    this.load();
  }

  submit(): void {
    const execution = this.home()?.appointment?.washExecution;
    if (!execution || !this.maySubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.lifecycle
      .submitExit({
        washExecutionId: execution.washExecutionId,
        expectedVersion: execution.executionVersion,
        materials: this.form.getRawValue(),
        idempotencyKey: this.createIdempotencyKey(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) => this.trackOperation(accepted),
        error: (error: unknown) => this.fail(error),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.loadHome
      .execute()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.loading.set(false);
          const materials = home.appointment?.washExecution?.submittedExitMaterials;
          if (materials) {
            this.form.setValue(materials);
          }
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private trackOperation(accepted: { operationId: string; pollPath: string }): void {
    this.operationTracker
      .trackAccepted(accepted, () => this.lifecycle.getOperation(accepted.operationId), {
        intervalMs: 600,
        maxPendingPolls: 100,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'SUCCEEDED') {
            void this.router.navigate(['/wash/student']);
            return;
          }
          this.submitting.set(false);
          this.error.set(
            'La salida no pudo registrarse. Actualiza el estado e inténtalo nuevamente.',
          );
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.submitting.set(false);
    this.error.set(
      error instanceof ApplicationError ? error.message : 'No fue posible registrar la salida.',
    );
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `wash-exit-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
