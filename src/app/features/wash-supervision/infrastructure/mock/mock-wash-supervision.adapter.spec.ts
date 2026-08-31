import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { MockWashJourneyStore } from '../../../wash-student-home/infrastructure/mock/mock-wash-journey.store';
import { MockWashSupervisionAdapter } from './mock-wash-supervision.adapter';

describe('MockWashSupervisionAdapter', () => {
  let adapter: MockWashSupervisionAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockWashJourneyStore, MockWashSupervisionAdapter],
    });
    adapter = TestBed.inject(MockWashSupervisionAdapter);
  });

  it('lists registered and in-progress appointments with explicit presentation statuses', async () => {
    const result = await firstValueFrom(adapter.getManualAppointments());

    expect(result.appointments.map((appointment) => appointment.manualSelectionStatus)).toEqual([
      'REGISTERED',
      'IN_PROGRESS',
      'IN_PROGRESS',
    ]);
    expect(result.appointments.map((appointment) => appointment.nextAction)).toEqual([
      'ENTRY',
      'EXIT_REVIEW',
      'EXIT_REVIEW',
    ]);
  });

  it('carries a selected registered appointment through arrival to entry decision', async () => {
    const appointments = await firstValueFrom(adapter.getManualAppointments());
    const selected = appointments.appointments.find(
      (appointment) => appointment.manualSelectionStatus === 'REGISTERED',
    )!;

    const accepted = await firstValueFrom(
      adapter.registerArrival({
        appointmentId: selected.appointment.appointmentId,
        idempotencyKey: 'manual-selection-arrival',
      }),
    );
    await firstValueFrom(adapter.getOperation(accepted.operationId));
    await firstValueFrom(adapter.getOperation(accepted.operationId));

    const refreshed = await firstValueFrom(
      adapter.lookup({
        lookupType: 'STUDENT_ENROLLMENT',
        studentEnrollment: selected.student.studentEnrollment,
      }),
    );
    expect(refreshed.nextAction).toBe('ENTRY_DECISION');
    expect(refreshed.washExecution?.status).toBe('PENDING_ENTRY');
  });

  it('removes a completed manual exit from the actionable list', async () => {
    const appointments = await firstValueFrom(adapter.getManualAppointments());
    const selected = appointments.appointments.find(
      (appointment) => appointment.washExecution?.status === 'EXIT_SUBMITTED',
    )!;
    const execution = selected.washExecution!;

    const accepted = await firstValueFrom(
      adapter.complete({
        washExecutionId: execution.washExecutionId,
        expectedVersion: execution.executionVersion,
        finalMaterials: execution.submittedExitMaterials!,
        idempotencyKey: 'manual-selection-complete',
      }),
    );
    await firstValueFrom(adapter.getOperation(accepted.operationId));
    await firstValueFrom(adapter.getOperation(accepted.operationId));

    const refreshed = await firstValueFrom(adapter.getManualAppointments());
    expect(
      refreshed.appointments.some(
        (appointment) =>
          appointment.appointment.appointmentId === selected.appointment.appointmentId,
      ),
    ).toBeFalse();
  });
});
