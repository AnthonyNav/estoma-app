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
  ExceptionalAuthorizationContext,
} from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-exceptional-authorization-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-exceptional-authorization.page.html',
  styleUrl: './wash-exceptional-authorization.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashExceptionalAuthorizationPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly supervision = inject(WashEntrySupervisionUseCase);
  private readonly operationTracker = inject(OperationTrackerService);
  private readonly intents = inject(IdempotentIntentService);

  readonly lookupForm = this.formBuilder.nonNullable.group({
    studentEnrollment: ['', Validators.required],
  });
  readonly grantForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });
  readonly context = signal<ExceptionalAuthorizationContext | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  lookup(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.supervision
      .getExceptionalAuthorizationContext(this.lookupForm.controls.studentEnrollment.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (context) => {
          this.context.set(context);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  grant(): void {
    const context = this.context();
    if (
      !context ||
      context.grantAction !== 'AVAILABLE' ||
      this.grantForm.invalid ||
      this.submitting()
    ) {
      this.grantForm.markAllAsTouched();
      return;
    }
    const reason = this.grantForm.controls.reason.value.trim();
    const intent = `wash.exceptional.grant:${context.student.studentAccountId}:${reason}`;
    this.track(
      intent,
      this.supervision.grantExceptionalAuthorization({
        studentAccountId: context.student.studentAccountId,
        reason,
        idempotencyKey: this.intents.key(intent),
      }),
    );
  }

  cancel(): void {
    const authorization = this.context()?.exceptionalAuthorization;
    if (!authorization || authorization.cancelAction !== 'AVAILABLE' || this.submitting()) {
      return;
    }
    const intent = `wash.exceptional.cancel:${authorization.authorizationId}`;
    this.track(
      intent,
      this.supervision.cancelExceptionalAuthorization({
        authorizationId: authorization.authorizationId,
        reason: 'La segunda cita ya no es necesaria',
        idempotencyKey: this.intents.key(intent),
      }),
    );
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
                this.lookup();
                return;
              }
              this.error.set(
                'La operación fue rechazada. Actualiza el contexto antes de decidir de nuevo.',
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
      error instanceof ApplicationError
        ? error.message
        : 'No fue posible consultar la autorización.',
    );
  }
}
