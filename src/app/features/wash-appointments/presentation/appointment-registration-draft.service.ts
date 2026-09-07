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
  operationId: string | null;
  result?: DurableOperation;
}

@Injectable({ providedIn: 'root' })
export class AppointmentRegistrationDraftService {
  private readonly session = inject(SessionStore);
  private readonly receipts = signal(new Map<string, PendingAppointmentSchedule>());
  private owner: string | null = null;
  private readonly draftState = signal<AppointmentDraft>(initialDraft);
  private readonly pendingScheduleState = signal<PendingAppointmentSchedule | null>(null);
  readonly courseLabel = signal<string | null>(null);
  readonly draft = this.draftState.asReadonly();
  readonly selectedTimeSlot = signal<AvailableTimeSlot | null>(null);
  readonly pendingSchedule = computed(() => {
    const accountId = this.session.session()?.accountId;
    return (
      this.pendingScheduleState() ?? (accountId ? (this.receipts().get(accountId) ?? null) : null)
    );
  });
  readonly canContinue = computed(() => this.draftState().regulationAccepted);

  constructor() {
    inject(SessionLifecycleService)
      .ended$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        const pending = this.pendingScheduleState();
        const owner = this.owner;
        this.reset();
        // Keep only reconciliation data in memory, scoped to its original account.
        if (owner && pending)
          this.receipts.update((receipts) => new Map(receipts).set(owner, pending));
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

  beginSchedule(command: ScheduleAppointmentCommand): void {
    this.owner = this.session.session()?.accountId ?? null;
    this.pendingScheduleState.set({ command, operationId: null });
  }

  setScheduleOperation(operationId: string): void {
    const pending = this.pendingSchedule();
    this.owner = this.session.session()?.accountId ?? this.owner;
    this.pendingScheduleState.set(pending ? { ...pending, operationId } : null);
  }

  setResult(result: DurableOperation): void {
    const pending = this.pendingSchedule();
    this.owner = this.session.session()?.accountId ?? this.owner;
    this.pendingScheduleState.set(pending ? { ...pending, result } : null);
  }

  clearPendingSchedule(): void {
    const owner = this.owner ?? this.session.session()?.accountId;
    if (owner)
      this.receipts.update((receipts) => {
        const updated = new Map(receipts);
        updated.delete(owner);
        return updated;
      });
    this.owner = null;
    this.pendingScheduleState.set(null);
  }

  reset(): void {
    this.draftState.set(initialDraft);
    this.courseLabel.set(null);
    this.selectedTimeSlot.set(null);
    this.clearPendingSchedule();
  }
}
