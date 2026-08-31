import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ManageWashAdministrationUseCase } from '../application/manage-wash-administration.use-case';
import {
  AcceptedOperation,
  AdminResources,
  AdminSupervisor,
  CurrentWeekOperation,
  ReplaceWeekDayCommand,
  WashAdministrationHome,
  WeekImpactPreview,
} from '../domain/models/wash-administration';

type AdministrationMode = 'home' | 'week' | 'resources' | 'supervisors';

@Component({
  selector: 'app-wash-administration-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-administration.page.html',
  styleUrl: './wash-administration.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashAdministrationPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly administration = inject(ManageWashAdministrationUseCase);
  private readonly operationTracker = inject(OperationTrackerService);

  readonly mode = this.route.snapshot.data['mode'] as AdministrationMode;
  readonly home = signal<WashAdministrationHome | null>(null);
  readonly week = signal<CurrentWeekOperation | null>(null);
  readonly preview = signal<WeekImpactPreview | null>(null);
  readonly resources = signal<AdminResources | null>(null);
  readonly supervisors = signal<AdminSupervisor[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly weekForm = this.formBuilder.nonNullable.group({
    dayOfWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
    openingTime: ['08:00:00', Validators.required],
    closingTime: ['17:00:00', Validators.required],
    slotDurationMinutes: [60, [Validators.required, Validators.min(1)]],
  });
  readonly supervisorSearch = this.formBuilder.nonNullable.group({ query: [''] });
  readonly supervisorForm = this.formBuilder.nonNullable.group({
    fullName: ['', Validators.required],
    institutionalEmail: ['', [Validators.required, Validators.email]],
    username: ['', Validators.required],
  });

  constructor() {
    this.load();
  }
  retry(): void {
    this.load();
  }

  previewDay(): void {
    const command = this.weekCommand();
    if (!command) {
      return;
    }
    this.administration
      .previewWeekDay(command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error: unknown) => this.fail(error),
      });
  }

  replaceDay(): void {
    const command = this.weekCommand();
    if (!command) {
      return;
    }
    this.track(this.administration.replaceWeekDay(command), () => this.loadWeek());
  }

  changeResource(
    resourceType: 'CABIN' | 'TANK',
    resourceId: string,
    action: 'activate' | 'deactivate' | 'retire',
  ): void {
    this.track(
      this.administration.changeResourceStatus({
        resourceType,
        resourceId,
        action,
        idempotencyKey: this.key(`resource-${action}`),
      }),
      () => this.loadResources(),
    );
  }

  searchSupervisors(): void {
    this.loadSupervisors(this.supervisorSearch.controls.query.value.trim());
  }

  createSupervisor(): void {
    if (this.supervisorForm.invalid || this.submitting()) {
      this.supervisorForm.markAllAsTouched();
      return;
    }
    this.track(
      this.administration.createSupervisorPerson({
        ...this.supervisorForm.getRawValue(),
        idempotencyKey: this.key('supervisor-person'),
      }),
      () => {
        this.supervisorForm.reset();
        this.loadSupervisors('');
      },
    );
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    switch (this.mode) {
      case 'home':
        this.administration
          .loadHome()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (home) => {
              this.home.set(home);
              this.loading.set(false);
            },
            error: (error: unknown) => this.fail(error),
          });
        break;
      case 'week':
        this.loadWeek();
        break;
      case 'resources':
        this.loadResources();
        break;
      case 'supervisors':
        this.loadSupervisors('');
        break;
    }
  }

  private loadWeek(): void {
    this.loading.set(true);
    this.administration
      .loadCurrentWeek()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (week) => {
          this.week.set(week);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }
  private loadResources(): void {
    this.loading.set(true);
    this.administration
      .loadResources()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resources) => {
          this.resources.set(resources);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }
  private loadSupervisors(query: string): void {
    this.loading.set(true);
    this.administration
      .loadSupervisors(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (supervisors) => {
          this.supervisors.set(supervisors);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private weekCommand(): ReplaceWeekDayCommand | null {
    const week = this.week();
    if (!week || this.weekForm.invalid) {
      this.weekForm.markAllAsTouched();
      return null;
    }
    const { dayOfWeek, openingTime, closingTime, slotDurationMinutes } =
      this.weekForm.getRawValue();
    return {
      calendarId: week.calendarId,
      dayOfWeek,
      intervals: [{ openingTime, closingTime, slotDurationMinutes }],
      idempotencyKey: this.key('week-day'),
    };
  }

  private track(request: Observable<AcceptedOperation>, afterSuccess: () => void): void {
    this.submitting.set(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accepted) =>
        this.operationTracker
          .trackAccepted(accepted, () => this.administration.getOperation(accepted.operationId), {
            intervalMs: 600,
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (operation) => {
              this.submitting.set(false);
              if (operation.status === 'SUCCEEDED') {
                afterSuccess();
                return;
              }
              this.error.set(
                'La operación fue rechazada. Actualiza la información antes de intentarlo otra vez.',
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
        : 'No fue posible cargar o actualizar la administración de Lavado.',
    );
  }
  private key(scope: string): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `${scope}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
}
