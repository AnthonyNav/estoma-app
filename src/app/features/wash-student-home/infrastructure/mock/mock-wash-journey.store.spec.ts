import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
import { SupervisorEntryLookup } from '../../../wash-supervision/domain/models/supervisor-entry';
import { MockWashJourneyStore } from './mock-wash-journey.store';

describe('MockWashJourneyStore', () => {
  let store: MockWashJourneyStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(MockWashJourneyStore);
  });

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

  it('propagates an entry rejection and its reason to the student home fixture', fakeAsync(() => {
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
        identityConfirmed: true,
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

  it('records an exit declaration after an authorized entry', fakeAsync(() => {
    let arrivalOperation = {} as AcceptedOperation;
    store
      .registerArrival({
        appointmentId: '11111111-1111-1111-1111-111111111111',
        idempotencyKey: 'arrival-key',
      })
      .subscribe((operation) => (arrivalOperation = operation));
    tick(250);
    resolveOperation(store, arrivalOperation.operationId);

    let pendingEntryLookup = {} as SupervisorEntryLookup;
    store
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: '201945678' })
      .subscribe((lookup) => (pendingEntryLookup = lookup));
    tick(350);

    let decisionOperation = {} as AcceptedOperation;
    store
      .decideEntry({
        washExecutionId: pendingEntryLookup.washExecution!.washExecutionId,
        expectedVersion: pendingEntryLookup.washExecution!.executionVersion,
        decision: 'AUTHORIZED',
        identityConfirmed: true,
        requirementsSatisfied: true,
        rejectionReason: null,
        idempotencyKey: 'decision-key',
      })
      .subscribe((operation) => (decisionOperation = operation));
    tick(250);
    resolveOperation(store, decisionOperation.operationId);

    let exitOperation = {} as AcceptedOperation;
    store
      .submitExit({
        washExecutionId: '44444444-4444-4444-4444-444444444444',
        expectedVersion: 1,
        materials: {
          packageCount: 2,
          greenPaperCassette8Count: 1,
          greenPaperCassette10Count: 0,
          witnessTapePortionCount: 0,
        },
        idempotencyKey: 'exit-key',
      })
      .subscribe((operation) => (exitOperation = operation));
    tick(250);
    resolveOperation(store, exitOperation.operationId);

    let homeStatus: string | undefined;
    store
      .loadStudentHome(null)
      .subscribe((home) => (homeStatus = home.appointment?.washExecution?.status));
    tick(250);
    expect(homeStatus).toBe('EXIT_SUBMITTED');
  }));

  it('connects reassignment and exit completion fixtures with the student state', fakeAsync(() => {
    store.applyFixture('pending-reassignment');

    let reassignmentOperation = {} as AcceptedOperation;
    store
      .resolveReassignment({
        washExecutionId: '44444444-4444-4444-4444-444444444444',
        cabinId: '66666666-6666-6666-6666-666666666666',
        tankId: '77777777-7777-7777-7777-777777777777',
      })
      .subscribe((operation) => (reassignmentOperation = operation));
    tick(250);
    resolveOperation(store, reassignmentOperation.operationId);

    let reassignedStatus: string | undefined;
    store
      .loadStudentHome(null)
      .subscribe((home) => (reassignedStatus = home.appointment?.washExecution?.status));
    tick(250);
    expect(reassignedStatus).toBe('IN_PROGRESS');

    store.applyFixture('exit-submitted');
    let completionOperation = {} as AcceptedOperation;
    store
      .completeExit({
        washExecutionId: '44444444-4444-4444-4444-444444444444',
        finalMaterials: {
          packageCount: 3,
          greenPaperCassette8Count: 1,
          greenPaperCassette10Count: 0,
          witnessTapePortionCount: 1,
        },
      })
      .subscribe((operation) => (completionOperation = operation));
    tick(250);
    resolveOperation(store, completionOperation.operationId);

    let completedStatus: string | undefined;
    store
      .loadStudentHome(null)
      .subscribe((home) => (completedStatus = home.appointment?.washExecution?.status));
    tick(250);
    expect(completedStatus).toBe('COMPLETED');
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
