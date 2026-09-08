import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
import { SupervisorEntryLookup } from '../../../wash-supervision/domain/models/supervisor-entry';
import { MockWashJourneyStore } from './mock-wash-journey.store';

describe('MockWashJourneyStore', () => {
  beforeEach(() => sessionStorage.removeItem('estoma.booking.demo.v1'));
  afterEach(() => sessionStorage.removeItem('estoma.booking.demo.v1'));
  let store: MockWashJourneyStore;

  afterEach(() => sessionStorage.removeItem('estoma.entry.demo.v2'));

  beforeEach(() => {
    sessionStorage.removeItem('estoma.entry.demo.v2');
    spyOn(Date, 'now').and.returnValue(new Date('2026-09-06T16:00:00Z').getTime());
    TestBed.configureTestingModule({});
    store = TestBed.inject(MockWashJourneyStore);
  });

  it('recovers scheduling and cancellation with the same operations after reload', fakeAsync(() => {
    const scheduled = scheduleAppointment(store);
    let restored = TestBed.runInInjectionContext(() => new MockWashJourneyStore());
    resolveOperation(restored, scheduled.operationId);
    let cancel!: AcceptedOperation;
    restored
      .cancel({
        appointmentId: '11111111-1111-1111-1111-111111111111',
        expectedVersion: 1,
        idempotencyKey: 'cancel-reload',
      })
      .subscribe((value) => (cancel = value));
    tick(250);
    restored = TestBed.runInInjectionContext(() => new MockWashJourneyStore());
    resolveOperation(restored, cancel.operationId);
    restored
      .loadStudentHome(null)
      .subscribe((home) => expect(home.appointment?.appointmentStatus).toBe('CANCELLED'));
    tick(250);
  }));
  it('starts without an appointment and retains a confirmed booking on later home reads', fakeAsync(() => {
    let appointmentId: string | null | undefined;
    store
      .loadStudentHome(null)
      .subscribe((home) => (appointmentId = home.appointment?.appointmentId ?? null));
    tick(250);
    expect(appointmentId).toBeNull();
    const scheduled = scheduleAppointment(store);
    resolveOperation(store, scheduled.operationId);
    store
      .loadStudentHome(null)
      .subscribe((home) => (appointmentId = home.appointment?.appointmentId ?? null));
    tick(250);
    expect(appointmentId).toBe('11111111-1111-1111-1111-111111111111');
  }));

  it('connects appointment scheduling with the supervisor arrival and authorization flow', fakeAsync(() => {
    const scheduleOperation = scheduleAppointment(store);
    resolveOperation(store, scheduleOperation.operationId);

    let scheduledLookup = {} as SupervisorEntryLookup;
    store
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((lookup) => {
        scheduledLookup = lookup;
      });
    tick(350);

    expect(scheduledLookup.appointment.appointmentStatus).toBe('SCHEDULED');
    expect(scheduledLookup.washExecution).toBeNull();

    let arrivalOperation = {} as AcceptedOperation;
    store
      .registerArrival({
        appointmentId: scheduledLookup.appointment.appointmentId,
        idempotencyKey: 'arrival-key',
      })
      .subscribe((operation) => {
        arrivalOperation = operation;
      });
    tick(250);
    resolveOperation(store, arrivalOperation.operationId);

    let pendingEntryLookup = {} as SupervisorEntryLookup;
    store
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((lookup) => {
        pendingEntryLookup = lookup;
      });
    tick(350);

    expect(pendingEntryLookup.washExecution?.status).toBe('PENDING_ENTRY');

    let decisionOperation = {} as AcceptedOperation;
    store
      .decideEntry({
        washExecutionId: pendingEntryLookup.washExecution!.washExecutionId,
        expectedVersion: 1,
        decision: 'AUTHORIZED',
        identityConfirmed: true,
        requirementsSatisfied: true,
        rejectionReason: null,
        idempotencyKey: 'decision-key',
      })
      .subscribe((operation) => {
        decisionOperation = operation;
      });
    tick(250);
    resolveOperation(store, decisionOperation.operationId);

    let authorizedLookup = {} as SupervisorEntryLookup;
    store
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((lookup) => {
        authorizedLookup = lookup;
      });
    tick(350);

    expect(authorizedLookup.washExecution?.status).toBe('IN_PROGRESS');
    expect(authorizedLookup.activeResourceAssignment?.cabin.code).toBe('107');
  }));

  it('recovers an accepted decision after reload without losing the arrived appointment', fakeAsync(() => {
    resolveOperation(store, scheduleAppointment(store).operationId);
    let arrival!: AcceptedOperation;
    store
      .registerArrival({
        appointmentId: '11111111-1111-1111-1111-111111111111',
        idempotencyKey: 'arrival-reload',
      })
      .subscribe((value) => (arrival = value));
    tick(250);
    resolveOperation(store, arrival.operationId);
    const command = {
      washExecutionId: '44444444-4444-4444-4444-444444444444',
      expectedVersion: 1,
      decision: 'AUTHORIZED' as const,
      identityConfirmed: true,
      requirementsSatisfied: true,
      rejectionReason: null,
      idempotencyKey: 'decision-reload',
    };
    let accepted!: AcceptedOperation;
    store.decideEntry(command).subscribe((value) => (accepted = value));
    tick(250);
    const restored = TestBed.runInInjectionContext(() => new MockWashJourneyStore());
    restored
      .decideEntry(command)
      .subscribe((value) => expect(value.operationId).toBe(accepted.operationId));
    tick(250);
    resolveOperation(restored, accepted.operationId);
    restored
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((value) => expect(value.washExecution?.status).toBe('IN_PROGRESS'));
    tick(350);
  }));

  it('propagates an entry rejection and its reason to the student home fixture', fakeAsync(() => {
    const scheduled = scheduleAppointment(store);
    resolveOperation(store, scheduled.operationId);
    let arrivalOperation = {} as AcceptedOperation;
    store
      .registerArrival({
        appointmentId: '11111111-1111-1111-1111-111111111111',
        idempotencyKey: 'arrival-key',
      })
      .subscribe((operation) => {
        arrivalOperation = operation;
      });
    tick(250);
    resolveOperation(store, arrivalOperation.operationId);

    let pendingEntryLookup = {} as SupervisorEntryLookup;
    store
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((lookup) => {
        pendingEntryLookup = lookup;
      });
    tick(350);

    let decisionOperation = {} as AcceptedOperation;
    store
      .decideEntry({
        washExecutionId: pendingEntryLookup.washExecution!.washExecutionId,
        expectedVersion: 1,
        decision: 'REJECTED',
        identityConfirmed: false,
        requirementsSatisfied: false,
        rejectionReason: 'El material no cumple las condiciones de ingreso.',
        idempotencyKey: 'decision-key',
      })
      .subscribe((operation) => {
        decisionOperation = operation;
      });
    tick(250);
    resolveOperation(store, decisionOperation.operationId);

    let homeReason: string | null | undefined;
    store.loadStudentHome(null).subscribe((home) => {
      homeReason = home.appointment?.washExecution?.rejectionReason;
    });
    tick(250);

    expect(homeReason).toBe('El material no cumple las condiciones de ingreso.');
  }));
});

function scheduleAppointment(store: MockWashJourneyStore): AcceptedOperation {
  let operation = {} as AcceptedOperation;
  store
    .schedule({
      appointmentType: 'NORMAL',
      instrumentCount: 15,
      pieceType: 'HIGH_SPEED',
      courseSectionId: '22222222-2222-2222-2222-222222222222',
      regulationAccepted: true,
      appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
      exceptionalAuthorizationId: null,
      idempotencyKey: 'schedule-key',
    })
    .subscribe((accepted) => {
      operation = accepted;
    });
  tick(250);

  return operation;
}

function resolveOperation(store: MockWashJourneyStore, operationId: string): void {
  let result = {} as DurableOperation;
  store.getOperation(operationId).subscribe((operation) => {
    result = operation;
  });
  tick(350);
  expect(result.status).toBe('PENDING');

  store.getOperation(operationId).subscribe((operation) => {
    result = operation;
  });
  tick(350);
  expect(result.status).toBe('SUCCEEDED');
}
