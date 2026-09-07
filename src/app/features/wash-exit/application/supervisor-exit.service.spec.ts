import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { SessionStore } from '../../authentication/application/session-store.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SupervisorExitService } from './supervisor-exit.service';
import {
  SUPERVISOR_EXIT_GATEWAY,
  SupervisorExitGateway,
  SupervisorExecutionDetail,
  canCompleteExit,
} from '../domain/supervisor-exit';
import {
  DurableOperation,
  SupervisorEntryLookup,
} from '../../wash-supervision/domain/models/supervisor-entry';
import { emptyMaterials } from '../domain/student-exit';
const materials = { ...emptyMaterials(), packageCount: 2 };
const lookup = {
  nextAction: 'EXIT_REVIEW',
  student: { displayName: 'Ana', studentEnrollment: '201945678' },
  appointment: { appointmentId: 'appointment', appointmentStatus: 'IN_PROGRESS' },
  washExecution: {
    washExecutionId: 'execution',
    executionVersion: 3,
    status: 'EXIT_SUBMITTED',
    exitSubmittedAt: '2026-09-06T18:00:00Z',
    submittedExitMaterials: materials,
  },
  activeResourceAssignment: { cabin: { name: 'Cabina 107' }, tank: { name: 'Tina B' } },
} as SupervisorEntryLookup;
const detail = {
  student: lookup.student,
  appointment: { appointmentId: 'appointment', appointmentStatus: 'COMPLETED' },
  washExecution: {
    washExecutionId: 'execution',
    executionVersion: 4,
    status: 'COMPLETED',
    completedAt: '2026-09-06T18:30:00Z',
    submittedExitMaterials: materials,
    finalExitMaterials: materials,
    activeResourceAssignment: null,
    lastResourceAssignment: lookup.activeResourceAssignment,
  },
} as SupervisorExecutionDetail;
describe('Supervisor exit completion', () => {
  let api: jasmine.SpyObj<SupervisorExitGateway>,
    operations: Subject<DurableOperation>,
    flow: SupervisorExitService;
  beforeEach(() => {
    sessionStorage.removeItem('estoma.supervisor-exit.receipts.v1');
    api = jasmine.createSpyObj('exit', ['complete', 'operation', 'detail']);
    operations = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPERVISOR_EXIT_GATEWAY, useValue: api },
        { provide: OperationTrackerService, useValue: { trackWith: () => operations } },
      ],
    });
    TestBed.inject(SessionStore).session.set({
      accountId: 'supervisor',
      sessionId: 's',
      accessToken: 'secret',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    api.complete.and.returnValue(
      of({
        operationId: 'op',
        status: 'PENDING',
        pollPath: '/api/v1/operations/op',
        submittedAt: new Date().toISOString(),
      }),
    );
    api.detail.and.returnValue(of(detail));
    flow = TestBed.inject(SupervisorExitService);
  });
  afterEach(() => sessionStorage.removeItem('estoma.supervisor-exit.receipts.v1'));
  it('requires the student submission, its context and nonempty materials', () => {
    expect(
      canCompleteExit({
        ...lookup,
        washExecution: { ...lookup.washExecution!, status: 'IN_PROGRESS' },
      }),
    ).toBeFalse();
    expect(
      canCompleteExit({
        ...lookup,
        washExecution: { ...lookup.washExecution!, submittedExitMaterials: null },
      }),
    ).toBeFalse();
    expect(canCompleteExit(lookup)).toBeTrue();
    flow.start(lookup, emptyMaterials());
    expect(api.complete).not.toHaveBeenCalled();
  });
  it('waits for the exact execution and final values after the operation succeeds', fakeAsync(() => {
    flow.start(lookup, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'PENDING' });
    flushMicrotasks();
    expect(flow.settled()).toBeNull();
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    flushMicrotasks();
    expect(api.detail).toHaveBeenCalledWith('execution');
    expect(flow.settled()).toEqual(detail);
    expect(flow.pending()).toBeNull();
  }));
  it('retains a successful operation if the exact read is unavailable and never repeats completion', fakeAsync(() => {
    api.detail.and.returnValue(throwError(() => new Error('unavailable')));
    flow.start(lookup, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    flushMicrotasks();
    expect(flow.pending()?.result?.status).toBe('SUCCEEDED');
    expect(flow.settled()).toBeNull();
    api.detail.and.returnValue(of(detail));
    void flow.resume();
    flushMicrotasks();
    expect(api.complete).toHaveBeenCalledTimes(1);
    expect(flow.settled()).toEqual(detail);
  }));
  it('does not accept a different appointment as proof of completion', fakeAsync(() => {
    api.detail.and.returnValue(
      of({
        ...detail,
        appointment: { ...detail.appointment, appointmentId: 'another-appointment' },
      }),
    );
    flow.start(lookup, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    flushMicrotasks();
    expect(flow.settled()).toBeNull();
    expect(flow.pending()).not.toBeNull();
    api.detail.and.returnValue(of(detail));
    tick(2000);
    flushMicrotasks();
    expect(flow.settled()).toEqual(detail);
  }));
  it('preserves key, version and quantities after a lost response and across recreation', fakeAsync(() => {
    api.complete.and.returnValue(throwError(() => new Error('lost response')));
    flow.start(lookup, materials);
    flushMicrotasks();
    const original = api.complete.calls.mostRecent().args[0];
    void flow.resume();
    flushMicrotasks();
    expect(api.complete.calls.mostRecent().args[0]).toEqual(original);
    const restored = TestBed.runInInjectionContext(() => new SupervisorExitService());
    expect(restored.pending()?.command).toEqual(original);
    expect(sessionStorage.getItem('estoma.supervisor-exit.receipts.v1')).not.toContain('secret');
  }));
  it('blocks new commands after an inconclusive operation', fakeAsync(() => {
    flow.start(lookup, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    flushMicrotasks();
    flow.start(lookup, materials);
    expect(api.complete).toHaveBeenCalledTimes(1);
    expect(flow.settled()).toBeNull();
  }));
});
