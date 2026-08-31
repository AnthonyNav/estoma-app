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
import { RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SupervisorLookup } from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-exit-review-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-exit-review.page.html',
  styleUrl: './wash-exit-review.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashExitReviewPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  readonly lookupForm = this.formBuilder.nonNullable.group({
    lookupType: ['STUDENT_ENROLLMENT' as 'STUDENT_ENROLLMENT' | 'QR'],
    query: ['', Validators.required],
  });
  readonly materialsForm = this.formBuilder.nonNullable.group({
    packageCount: [0, [Validators.required, Validators.min(0)]],
    greenPaperCassette8Count: [0, [Validators.required, Validators.min(0)]],
    greenPaperCassette10Count: [0, [Validators.required, Validators.min(0)]],
    witnessTapePortionCount: [0, [Validators.required, Validators.min(0)]],
  });
  readonly lookup = signal<SupervisorLookup | null>(null);
  readonly loading = signal(false);
  readonly completing = signal(false);
  readonly error = signal<string | null>(null);
  readonly canComplete = computed(() => {
    const execution = this.lookup()?.washExecution;
    return execution?.status === 'EXIT_SUBMITTED' && this.materialsForm.valid && !this.completing();
  });

  search(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    const { lookupType, query } = this.lookupForm.getRawValue();
    const request =
      lookupType === 'QR'
        ? { lookupType, qrRepresentation: query.trim() }
        : { lookupType, studentEnrollment: query.trim() };
    this.loading.set(true);
    this.error.set(null);
    this.supervision
      .lookup(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookup) => {
          this.lookup.set(lookup);
          this.loading.set(false);
          const submitted = lookup.washExecution?.submittedExitMaterials;
          if (submitted) {
            this.materialsForm.setValue(submitted);
          }
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  complete(): void {
    const execution = this.lookup()?.washExecution;
    if (!execution || !this.canComplete()) {
      return;
    }
    this.completing.set(true);
    this.supervision
      .complete({
        washExecutionId: execution.washExecutionId,
        expectedVersion: execution.executionVersion,
        finalMaterials: this.materialsForm.getRawValue(),
        idempotencyKey: this.createIdempotencyKey(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accepted) =>
          this.operationTracker
            .trackAccepted(accepted, () => this.supervision.getOperation(accepted.operationId), {
              intervalMs: 600,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (operation) => {
                this.completing.set(false);
                if (operation.status === 'SUCCEEDED') {
                  this.search();
                  return;
                }
                this.error.set(
                  'No fue posible finalizar el lavado. Actualiza la consulta e inténtalo nuevamente.',
                );
              },
              error: (error: unknown) => this.fail(error),
            }),
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.completing.set(false);
    this.error.set(
      error instanceof ApplicationError
        ? error.message
        : 'No fue posible consultar o finalizar la atención.',
    );
  }

  private createIdempotencyKey(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `wash-complete-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
