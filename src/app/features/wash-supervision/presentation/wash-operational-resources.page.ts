import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { IdempotentIntentService } from '../../../core/api/idempotent-intent.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import {
  AcceptedOperation,
  OperationalResources,
  ResourceUnavailability,
} from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-operational-resources-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-operational-resources.page.html',
  styleUrl: './wash-operational-resources.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashOperationalResourcesPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);
  private readonly intents = inject(IdempotentIntentService);

  readonly resources = signal<OperationalResources | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly disableForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
    causeType: ['FAILURE' as 'FAILURE' | 'MANUAL_DISABLE'],
  });

  constructor() {
    this.load();
  }

  disableCabin(cabinId: string): void {
    this.disable(cabinId, null);
  }
  disableTank(tankId: string): void {
    this.disable(null, tankId);
  }

  restore(unavailability: ResourceUnavailability): void {
    const intent = `wash.resource.restore:${unavailability.resourceUnavailabilityId}:${unavailability.unavailabilityVersion}`;
    this.track(
      intent,
      this.supervision.restoreResource({
        resourceUnavailabilityId: unavailability.resourceUnavailabilityId,
        resolution: null,
        expectedVersion: unavailability.unavailabilityVersion,
        idempotencyKey: this.intents.key(intent),
      }),
    );
  }

  private disable(cabinId: string | null, tankId: string | null): void {
    if (this.disableForm.invalid || this.submitting()) {
      this.disableForm.markAllAsTouched();
      return;
    }
    const { reason, causeType } = this.disableForm.getRawValue();
    const intent = `wash.resource.disable:${cabinId ?? tankId}:${causeType}:${reason.trim()}`;
    this.track(
      intent,
      this.supervision.disableResource({
        cabinId,
        tankId,
        causeType,
        reason: reason.trim(),
        detectedDuringWashExecutionId: null,
        idempotencyKey: this.intents.key(intent),
      }),
    );
  }

  private load(): void {
    this.loading.set(true);
    this.supervision
      .getOperationalResources()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resources) => {
          this.resources.set(resources);
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
                this.load();
                return;
              }
              this.error.set(
                'La operación fue rechazada. Actualiza los recursos antes de intentarlo otra vez.',
              );
            },
            error: (error: unknown) => this.fail(error),
          }),
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.submitting.set(false);
    this.error.set(
      error instanceof ApplicationError ? error.message : 'No fue posible actualizar los recursos.',
    );
  }
}
