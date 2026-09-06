import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';

import {
  AppointmentDraft,
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
}

@Injectable({ providedIn: 'root' })
export class AppointmentRegistrationDraftService {
  private readonly draftState = signal<AppointmentDraft>(initialDraft);
  private readonly pendingScheduleState = signal<PendingAppointmentSchedule | null>(null);
  readonly draft = this.draftState.asReadonly();
  readonly selectedTimeSlot = signal<AvailableTimeSlot | null>(null);
  readonly pendingSchedule = this.pendingScheduleState.asReadonly();
  readonly canContinue = computed(() => this.draftState().regulationAccepted);

  constructor() {
    inject(SessionLifecycleService)
      .ended$.pipe(takeUntilDestroyed())
      .subscribe(() => this.reset());
  }

  acceptRegulation(accepted: boolean): void {
    this.draftState.update((draft) => ({ ...draft, regulationAccepted: accepted }));
  }

  update(draft: Omit<AppointmentDraft, 'regulationAccepted'>): void {
    this.draftState.update((current) => ({ ...current, ...draft }));
    this.selectedTimeSlot.set(null);
    this.clearPendingSchedule();
  }

  selectTimeSlot(timeSlot: AvailableTimeSlot): void {
    this.selectedTimeSlot.set(timeSlot);
  }

  beginSchedule(command: ScheduleAppointmentCommand): void {
    this.pendingScheduleState.set({ command, operationId: null });
  }

  setScheduleOperation(operationId: string): void {
    this.pendingScheduleState.update((pending) =>
      pending ? { ...pending, operationId } : pending,
    );
  }

  clearPendingSchedule(): void {
    this.pendingScheduleState.set(null);
  }

  reset(): void {
    this.draftState.set(initialDraft);
    this.selectedTimeSlot.set(null);
    this.clearPendingSchedule();
  }
}
