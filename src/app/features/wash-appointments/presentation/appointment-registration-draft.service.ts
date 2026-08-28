import { Injectable, computed, signal } from '@angular/core';

import { AppointmentDraft, AvailableTimeSlot } from '../domain/models/appointment-registration';

const initialDraft: AppointmentDraft = {
  appointmentType: 'NORMAL',
  instrumentCount: 15,
  pieceType: 'HIGH_SPEED',
  courseSectionId: '',
  regulationAccepted: false,
};

@Injectable({ providedIn: 'root' })
export class AppointmentRegistrationDraftService {
  private readonly draftState = signal<AppointmentDraft>(initialDraft);
  readonly draft = this.draftState.asReadonly();
  readonly selectedTimeSlot = signal<AvailableTimeSlot | null>(null);
  readonly canContinue = computed(() => this.draftState().regulationAccepted);

  acceptRegulation(accepted: boolean): void {
    this.draftState.update((draft) => ({ ...draft, regulationAccepted: accepted }));
  }

  update(draft: Omit<AppointmentDraft, 'regulationAccepted'>): void {
    this.draftState.update((current) => ({ ...current, ...draft }));
    this.selectedTimeSlot.set(null);
  }

  selectTimeSlot(timeSlot: AvailableTimeSlot): void {
    this.selectedTimeSlot.set(timeSlot);
  }

  reset(): void {
    this.draftState.set(initialDraft);
    this.selectedTimeSlot.set(null);
  }
}
