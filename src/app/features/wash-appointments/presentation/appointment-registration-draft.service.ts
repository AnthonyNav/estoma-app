import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';

import {
  AppointmentDraft,
  DurableOperation,
  AvailableTimeSlot,
  ScheduleAppointmentCommand,
} from '../domain/models/appointment-registration';

const initialDraft: AppointmentDraft = {
  appointmentType: 'NORMAL',
  instrumentCount: 15,
  pieceType: 'HIGH_SPEED',
  courseSectionId: '',
  regulationAccepted: false,
};

export interface PendingAppointmentSchedule {
  command: ScheduleAppointmentCommand;
  attempted?: boolean;
  operationId: string | null;
  result?: DurableOperation;
}

@Injectable({ providedIn: 'root' })
export class AppointmentRegistrationDraftService {
  private readonly session = inject(SessionStore);
  private readonly receipts = signal(this.restore());
  readonly storageError = signal<string | null>(null);
  private readonly draftState = signal<AppointmentDraft>(initialDraft);
  readonly courseLabel = signal<string | null>(null);
  readonly draft = this.draftState.asReadonly();
  readonly selectedTimeSlot = signal<AvailableTimeSlot | null>(null);
  readonly pendingSchedule = computed(
    () => this.receipts().get(this.session.session()?.accountId ?? '') ?? null,
  );
  readonly canContinue = computed(() => this.draftState().regulationAccepted);

  constructor() {
    inject(SessionLifecycleService)
      .ended$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.draftState.set(initialDraft);
        this.courseLabel.set(null);
        this.selectedTimeSlot.set(null);
      });
  }

  acceptRegulation(accepted: boolean): void {
    if (this.pendingSchedule()) return;
    this.draftState.update((draft) => ({ ...draft, regulationAccepted: accepted }));
  }

  update(
    draft: Omit<AppointmentDraft, 'regulationAccepted'>,
    courseLabel: string | null = null,
  ): void {
    if (this.pendingSchedule()) return;
    this.draftState.update((current) => ({ ...current, ...draft }));
    this.courseLabel.set(courseLabel);
    this.selectedTimeSlot.set(null);
    this.clearPendingSchedule();
  }

  selectTimeSlot(timeSlot: AvailableTimeSlot): void {
    this.selectedTimeSlot.set(timeSlot);
  }

  private restore(): Map<string, PendingAppointmentSchedule> {
    try {
      const data = JSON.parse(sessionStorage.getItem('estoma.booking.receipts.v1') ?? '[]');
      return new Map(data);
    } catch {
      return new Map();
    }
  }
  private persist(values: Map<string, PendingAppointmentSchedule>): boolean {
    try {
      sessionStorage.setItem('estoma.booking.receipts.v1', JSON.stringify([...values]));
      this.receipts.set(values);
      this.storageError.set(null);
      return true;
    } catch {
      if (this.pendingSchedule()) this.receipts.set(values);
      this.storageError.set(
        'No pudimos guardar el seguimiento. Habilita el almacenamiento del navegador antes de continuar.',
      );
      return false;
    }
  }
  beginSchedule(command: ScheduleAppointmentCommand): boolean {
    const owner = this.session.session()?.accountId;
    if (!owner || this.pendingSchedule()) return false;
    return this.persist(
      new Map(this.receipts()).set(owner, { command: structuredClone(command), operationId: null }),
    );
  }
  markAttempted(): boolean {
    const pending = this.pendingSchedule(),
      owner = this.session.session()?.accountId;
    if (!pending || !owner) return false;
    return this.persist(new Map(this.receipts()).set(owner, { ...pending, attempted: true }));
  }
  setScheduleOperation(operationId: string): void {
    const pending = this.pendingSchedule(),
      owner = this.session.session()?.accountId;
    if (pending && owner)
      this.persist(new Map(this.receipts()).set(owner, { ...pending, operationId }));
  }
  setResult(result: DurableOperation): void {
    const pending = this.pendingSchedule(),
      owner = this.session.session()?.accountId;
    if (pending && owner) this.persist(new Map(this.receipts()).set(owner, { ...pending, result }));
  }
  clearPendingSchedule(): void {
    const owner = this.session.session()?.accountId;
    if (!owner) return;
    const values = new Map(this.receipts());
    values.delete(owner);
    this.persist(values);
  }

  reset(): void {
    this.draftState.set(initialDraft);
    this.courseLabel.set(null);
    this.selectedTimeSlot.set(null);
    this.clearPendingSchedule();
  }
}
