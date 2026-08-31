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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { IdempotentIntentService } from '../../../core/api/idempotent-intent.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { EntryLookupRequest, SupervisorLookup } from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { QrCameraScannerComponent } from './qr-camera-scanner.component';

@Component({
  selector: 'app-wash-exit-review-page',
  imports: [ReactiveFormsModule, RouterLink, QrCameraScannerComponent],
  templateUrl: './wash-exit-review.page.html',
  styleUrl: './wash-exit-review.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashExitReviewPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);
  private readonly intents = inject(IdempotentIntentService);
  private lastRequest: EntryLookupRequest | null = null;

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
  readonly isReviewView = this.route.snapshot.data['mode'] === 'review';
  readonly canComplete = computed(() => {
    const execution = this.lookup()?.washExecution;
    return execution?.status === 'EXIT_SUBMITTED' && this.materialsForm.valid && !this.completing();
  });

  constructor() {
    this.restoreManualSelection();
  }

  searchByQr(qrRepresentation: string): void {
    this.lookupAppointment({ lookupType: 'QR', qrRepresentation });
  }

  private lookupAppointment(request: EntryLookupRequest): void {
    this.lastRequest = request;
    this.loading.set(true);
    this.error.set(null);
    this.lookup.set(null);
    this.supervision
      .lookup(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookup) => {
          this.applyLookup(lookup, request);
          if (!this.isReviewView) {
            this.openReview(lookup);
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
    const finalMaterials = this.materialsForm.getRawValue();
    const intent = `wash.complete:${execution.washExecutionId}:${execution.executionVersion}:${JSON.stringify(finalMaterials)}`;
    this.supervision
      .complete({
        washExecutionId: execution.washExecutionId,
        expectedVersion: execution.executionVersion,
        finalMaterials,
        idempotencyKey: this.intents.key(intent),
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
                this.intents.complete(intent);
                if (operation.status === 'SUCCEEDED') {
                  this.refreshLookup();
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

  private refreshLookup(): void {
    if (!this.lastRequest) {
      return;
    }
    this.lookupAppointment(this.lastRequest);
  }

  private restoreManualSelection(): void {
    if (!this.isReviewView) {
      return;
    }

    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    const selected = state['supervisorLookup'];
    if (!this.isSupervisorLookup(selected)) {
      return;
    }

    this.applyLookup(selected, {
      lookupType: 'STUDENT_ENROLLMENT',
      studentEnrollment: selected.student.studentEnrollment,
    });
  }

  private applyLookup(lookup: SupervisorLookup, request: EntryLookupRequest): void {
    this.lastRequest = request;
    this.lookup.set(lookup);
    this.loading.set(false);
    const submitted = lookup.washExecution?.submittedExitMaterials;
    if (submitted) {
      this.materialsForm.setValue(submitted);
    }
  }

  private openReview(lookup: SupervisorLookup): void {
    void this.router.navigate(['/wash/supervision/exit/review'], {
      state: { supervisorLookup: lookup },
    });
  }

  private isSupervisorLookup(value: unknown): value is SupervisorLookup {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<SupervisorLookup>;
    return (
      typeof candidate.serviceDate === 'string' &&
      typeof candidate.nextAction === 'string' &&
      typeof candidate.student?.studentEnrollment === 'string' &&
      typeof candidate.appointment?.appointmentId === 'string'
    );
  }
}
