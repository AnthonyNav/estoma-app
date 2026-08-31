import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { IdempotentIntentService } from '../../../core/api/idempotent-intent.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import {
  AcceptedOperation,
  PendingReassignment,
  ReassignmentCandidate,
  ReassignmentCandidates,
} from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-reassignments-page',
  imports: [RouterLink],
  templateUrl: './wash-reassignments.page.html',
  styleUrl: './wash-reassignments.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashReassignmentsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);
  private readonly intents = inject(IdempotentIntentService);

  readonly pending = signal<PendingReassignment[]>([]);
  readonly candidates = signal<ReassignmentCandidates | null>(null);
  readonly selected = signal<ReassignmentCandidate | null>(null);
  readonly loading = signal(true);
  readonly loadingCandidates = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly mayCancelForCapacity = computed(
    () =>
      this.candidates()?.recommendedCandidate === null &&
      this.candidates()?.candidates.length === 0,
  );

  constructor() {
    this.loadPending();
  }

  choose(item: PendingReassignment): void {
    this.loadingCandidates.set(true);
    this.error.set(null);
    this.selected.set(null);
    this.supervision
      .getReassignmentCandidates(item.washExecutionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (candidates) => {
          this.candidates.set(candidates);
          this.selected.set(candidates.recommendedCandidate);
          this.loadingCandidates.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  select(candidate: ReassignmentCandidate): void {
    if (!this.submitting()) {
      this.selected.set(candidate);
    }
  }

  assign(): void {
    const candidates = this.candidates();
    const selected = this.selected();
    if (!candidates || !selected || this.submitting()) {
      return;
    }
    const intent = `wash.reassignment:${candidates.washExecutionId}:${candidates.executionVersion}:${selected.cabinId}:${selected.tankId}`;
    this.track(
      intent,
      this.supervision.reassign({
        washExecutionId: candidates.washExecutionId,
        cabinId: selected.cabinId,
        tankId: selected.tankId,
        expectedVersion: candidates.executionVersion,
        idempotencyKey: this.intents.key(intent),
      }),
    );
  }

  cancelForCapacity(): void {
    const candidates = this.candidates();
    if (!candidates || !this.mayCancelForCapacity() || this.submitting()) {
      return;
    }
    const intent = `wash.capacity-cancel:${candidates.washExecutionId}:${candidates.executionVersion}`;
    this.track(
      intent,
      this.supervision.cancelForCapacity({
        washExecutionId: candidates.washExecutionId,
        expectedVersion: candidates.executionVersion,
        cancellationReason: null,
        idempotencyKey: this.intents.key(intent),
      }),
    );
  }

  private loadPending(): void {
    this.loading.set(true);
    this.supervision
      .getPendingReassignments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pending) => {
          this.pending.set(pending);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private track(intent: string, request: Observable<AcceptedOperation>): void {
    this.submitting.set(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accepted) =>
        this.operationTracker
          .trackAccepted(accepted, () => this.supervision.getOperation(accepted.operationId), {
            intervalMs: 600,
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (operation) => {
              this.submitting.set(false);
              this.intents.complete(intent);
              if (operation.status === 'SUCCEEDED') {
                this.candidates.set(null);
                this.selected.set(null);
                this.loadPending();
                return;
              }
              this.error.set(
                'La operación fue rechazada. Actualiza los candidatos antes de decidir de nuevo.',
              );
            },
            error: (error: unknown) => this.fail(error),
          }),
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.loadingCandidates.set(false);
    this.submitting.set(false);
    this.error.set(
      error instanceof ApplicationError ? error.message : 'No fue posible completar la operación.',
    );
  }
}
