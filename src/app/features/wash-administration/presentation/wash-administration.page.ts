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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { IdempotentIntentService } from '../../../core/api/idempotent-intent.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ManageWashAdministrationUseCase } from '../application/manage-wash-administration.use-case';
import {
  AcceptedOperation,
  AdminCabin,
  AdminResources,
  AdminSupervisor,
  CabinType,
  CurrentWeekOperation,
  ReplaceWeekDayCommand,
  WashAdministrationHome,
  WeekImpactPreview,
} from '../domain/models/wash-administration';

type AdministrationMode = 'home' | 'week' | 'resources' | 'supervisors';
type ResourceAction = 'activate' | 'deactivate' | 'retire';

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
  private readonly intents = inject(IdempotentIntentService);

  readonly mode = this.route.snapshot.data['mode'] as AdministrationMode;
  readonly home = signal<WashAdministrationHome | null>(null);
  readonly week = signal<CurrentWeekOperation | null>(null);
  readonly preview = signal<WeekImpactPreview | null>(null);
  readonly resources = signal<AdminResources | null>(null);
  readonly selectedCabinId = signal<string | null>(null);
  readonly selectedCabin = computed(() => {
    const id = this.selectedCabinId();
    return this.resources()?.cabins.find((cabin) => cabin.cabinId === id) ?? null;
  });
  readonly selectedTankId = signal<string | null>(null);
  readonly selectedTank = computed(
    () => this.selectedCabin()?.tanks.find((tank) => tank.tankId === this.selectedTankId()) ?? null,
  );
  readonly supervisors = signal<AdminSupervisor[]>([]);
  readonly selectedSupervisorId = signal<string | null>(null);
  readonly selectedSupervisor = computed(
    () =>
      this.supervisors().find(
        (supervisor) => supervisor.accountId === this.selectedSupervisorId(),
      ) ?? null,
  );
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly weekForm = this.formBuilder.nonNullable.group({
    dayOfWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
    openingTime: ['08:00', Validators.required],
    closingTime: ['17:00', Validators.required],
    slotDurationMinutes: [60, [Validators.required, Validators.min(1)]],
  });
  readonly resourceReason = this.formBuilder.nonNullable.control('', Validators.maxLength(500));
  readonly cabinForm = this.formBuilder.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    cabinType: ['NORMAL' as CabinType, Validators.required],
  });
  readonly cabinEditForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    cabinType: ['NORMAL' as CabinType, Validators.required],
  });
  readonly tankForm = this.formBuilder.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    configuredCapacity: [1, [Validators.required, Validators.min(1)]],
  });
  readonly tankEditForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    configuredCapacity: [1, [Validators.required, Validators.min(1)]],
  });
  readonly supervisorSearch = this.formBuilder.nonNullable.group({ query: [''] });
  readonly supervisorForm = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    paternalSurname: ['', Validators.required],
    maternalSurname: [''],
    institutionalEmail: ['', [Validators.required, Validators.email]],
    username: ['', Validators.required],
  });
  readonly suspensionReason = this.formBuilder.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(500),
  ]);

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
    const intent = `admin.week:${command.calendarId}:${command.dayOfWeek}:${JSON.stringify(command.expectedSchedules)}:${JSON.stringify(command.desiredIntervals)}`;
    this.track(
      intent,
      this.administration.replaceWeekDay({ ...command, idempotencyKey: this.intents.key(intent) }),
      () => this.loadWeek(),
    );
  }

  selectCabin(cabin: AdminCabin): void {
    this.selectedCabinId.set(cabin.cabinId);
    this.selectedTankId.set(null);
    this.cabinEditForm.setValue({ name: cabin.name, cabinType: cabin.cabinType });
  }

  registerCabin(): void {
    if (this.cabinForm.invalid || this.submitting()) {
      this.cabinForm.markAllAsTouched();
      return;
    }
    const value = this.cabinForm.getRawValue();
    const intent = `admin.cabin.create:${value.code}:${value.name}:${value.cabinType}`;
    const key = this.intents.key(intent);
    this.track(
      intent,
      this.administration.registerCabin({ ...value, cabinId: key, idempotencyKey: key }),
      () => {
        this.cabinForm.reset({ code: '', name: '', cabinType: 'NORMAL' });
        this.loadResources();
      },
    );
  }

  updateCabin(): void {
    const cabin = this.selectedCabin();
    if (!cabin || cabin.status === 'RETIRED' || this.cabinEditForm.invalid || this.submitting()) {
      this.cabinEditForm.markAllAsTouched();
      return;
    }
    const value = this.cabinEditForm.getRawValue();
    const intent = `admin.cabin.update:${cabin.cabinId}:${cabin.version}:${value.name}:${value.cabinType}`;
    this.track(
      intent,
      this.administration.updateCabin({
        ...value,
        cabinId: cabin.cabinId,
        expectedVersion: cabin.version,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadResources(),
    );
  }

  registerTank(): void {
    const cabin = this.selectedCabin();
    if (!cabin || cabin.status === 'RETIRED' || this.tankForm.invalid || this.submitting()) {
      this.tankForm.markAllAsTouched();
      return;
    }
    const value = this.tankForm.getRawValue();
    const intent = `admin.tank.create:${cabin.cabinId}:${value.code}:${value.name}:${value.configuredCapacity}`;
    const key = this.intents.key(intent);
    this.track(
      intent,
      this.administration.registerTank({
        ...value,
        cabinId: cabin.cabinId,
        tankId: key,
        idempotencyKey: key,
      }),
      () => {
        this.tankForm.reset({ code: '', name: '', configuredCapacity: 1 });
        this.loadResources();
      },
    );
  }

  beginTankEdit(tank: AdminCabin['tanks'][number]): void {
    this.selectedTankId.set(tank.tankId);
    this.tankEditForm.setValue({ name: tank.name, configuredCapacity: tank.configuredCapacity });
  }

  updateTank(): void {
    const tank = this.selectedTank();
    if (!tank || tank.status === 'RETIRED' || this.tankEditForm.invalid || this.submitting()) {
      this.tankEditForm.markAllAsTouched();
      return;
    }
    const value = this.tankEditForm.getRawValue();
    const intent = `admin.tank.update:${tank.tankId}:${tank.version}:${value.name}:${value.configuredCapacity}`;
    this.track(
      intent,
      this.administration.updateTank({
        ...value,
        tankId: tank.tankId,
        expectedVersion: tank.version,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadResources(),
    );
  }

  changeResource(
    resourceType: 'CABIN' | 'TANK',
    resource: AdminCabin | AdminCabin['tanks'][number],
    action: ResourceAction,
  ): void {
    if (this.submitting()) {
      return;
    }
    const reason = this.resourceReason.value.trim();
    if (action !== 'activate' && !reason) {
      this.resourceReason.markAsTouched();
      this.error.set('Indica el motivo antes de desactivar o retirar un recurso.');
      return;
    }
    const resourceId = 'cabinId' in resource ? resource.cabinId : resource.tankId;
    const intent = `admin.resource:${resourceType}:${resourceId}:${resource.version}:${action}:${reason}`;
    this.track(
      intent,
      this.administration.changeResourceStatus({
        resourceType,
        resourceId,
        action,
        expectedVersion: resource.version,
        reason: action === 'activate' ? null : reason,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadResources(),
    );
  }

  searchSupervisors(): void {
    this.loadSupervisors(this.supervisorSearch.controls.query.value.trim());
  }

  selectSupervisor(supervisor: AdminSupervisor): void {
    this.selectedSupervisorId.set(supervisor.accountId);
  }

  createSupervisor(): void {
    if (this.supervisorForm.invalid || this.submitting()) {
      this.supervisorForm.markAllAsTouched();
      return;
    }
    const value = this.supervisorForm.getRawValue();
    const command = { ...value, maternalSurname: value.maternalSurname.trim() || null };
    const intent = `admin.supervisor.create:${command.institutionalEmail}:${command.username}`;
    this.track(
      intent,
      this.administration.createSupervisorPerson({
        ...command,
        idempotencyKey: this.intents.key(intent),
      }),
      () => {
        this.supervisorForm.reset({
          firstName: '',
          paternalSurname: '',
          maternalSurname: '',
          institutionalEmail: '',
          username: '',
        });
        this.loadSupervisors('');
      },
    );
  }

  suspendSupervisor(): void {
    const supervisor = this.selectedSupervisor();
    const reasonDetail = this.suspensionReason.value.trim();
    if (
      !supervisor ||
      supervisor.washAccessStatus !== 'ACTIVE' ||
      supervisor.washAccessVersion === null ||
      !reasonDetail ||
      this.submitting()
    ) {
      this.suspensionReason.markAsTouched();
      return;
    }
    const intent = `admin.supervisor.suspend:${supervisor.accountId}:${supervisor.washAccessVersion}:${reasonDetail}`;
    this.track(
      intent,
      this.administration.suspendWashAccess({
        accountId: supervisor.accountId,
        expectedVersion: supervisor.washAccessVersion,
        reasonCode: 'ADMINISTRATIVE_SUSPENSION',
        reasonDetail,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadSupervisors(''),
    );
  }

  restoreSupervisor(): void {
    const supervisor = this.selectedSupervisor();
    if (
      !supervisor ||
      supervisor.washAccessStatus !== 'SUSPENDED' ||
      supervisor.washAccessVersion === null ||
      this.submitting()
    ) {
      return;
    }
    const intent = `admin.supervisor.restore:${supervisor.accountId}:${supervisor.washAccessVersion}`;
    this.track(
      intent,
      this.administration.restoreWashAccess({
        accountId: supervisor.accountId,
        expectedVersion: supervisor.washAccessVersion,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadSupervisors(''),
    );
  }

  regenerateCredential(): void {
    const supervisor = this.selectedSupervisor();
    if (!supervisor || this.submitting()) {
      return;
    }
    const intent = `admin.supervisor.credential:${supervisor.accountId}:${supervisor.initialAccessDelivery?.status ?? 'NONE'}`;
    this.track(
      intent,
      this.administration.regenerateSupervisorCredential({
        accountId: supervisor.accountId,
        idempotencyKey: this.intents.key(intent),
      }),
      () => this.loadSupervisors(''),
    );
  }

  supervisorWorkflowLabel(supervisor: AdminSupervisor): string {
    if (supervisor.effectiveAccess && supervisor.initialAccessDelivery?.status === 'ACCEPTED') {
      return 'COMPLETED';
    }
    if (supervisor.initialAccessDelivery?.status === 'FAILED') {
      return 'NEEDS_ATTENTION';
    }
    if (supervisor.initialAccessDelivery?.status === 'PENDING_DELIVERY') {
      return 'EMAIL_PENDING';
    }
    return 'WAITING_FOR_CONVERGENCE';
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
          const selected = resources.cabins.find(
            (cabin) => cabin.cabinId === this.selectedCabinId(),
          );
          const cabin = selected ?? resources.cabins[0] ?? null;
          this.selectedCabinId.set(cabin?.cabinId ?? null);
          if (cabin) {
            this.cabinEditForm.setValue({ name: cabin.name, cabinType: cabin.cabinType });
          }
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
          const selected = supervisors.find(
            (supervisor) => supervisor.accountId === this.selectedSupervisorId(),
          );
          this.selectedSupervisorId.set(selected?.accountId ?? supervisors[0]?.accountId ?? null);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private weekCommand(): ReplaceWeekDayCommand | null {
    const week = this.week();
    if (!week?.calendar || week.editing.status !== 'AVAILABLE' || this.weekForm.invalid) {
      this.weekForm.markAllAsTouched();
      return null;
    }
    const { dayOfWeek, openingTime, closingTime, slotDurationMinutes } =
      this.weekForm.getRawValue();
    const currentDay = week.days.find((day) => day.dayOfWeek === dayOfWeek);
    if (!currentDay) {
      return null;
    }
    return {
      calendarId: week.calendar.calendarId,
      dayOfWeek,
      expectedSchedules: currentDay.intervals.map(({ scheduleId, expectedVersion }) => ({
        scheduleId,
        expectedVersion,
      })),
      desiredIntervals: [{ openingTime, closingTime, slotDurationMinutes }],
      idempotencyKey: '',
    };
  }

  private track(
    intent: string,
    request: Observable<AcceptedOperation>,
    afterSuccess: () => void,
  ): void {
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
              this.intents.complete(intent);
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
}
