import { ApplicationError } from '../../../core/api/application-error';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { REASSIGNMENT_GATEWAY, ReassignmentGateway } from '../domain/ports/reassignment.gateway';
import { ReassignmentWorkflowService } from './reassignment-workflow.service';
import { SupervisorExecutionDetail } from '../../wash-exit/domain/supervisor-exit';
import { DurableOperation } from '../domain/models/supervisor-entry';
import { candidateExamples, pendingExample } from '../infrastructure/mock/reassignment.fixtures';
const candidate = candidateExamples[0];
const result = {
  appointment: { ...pendingExample.appointment, appointmentStatus: 'IN_PROGRESS' },
  student: { studentEnrollment: pendingExample.student!.enrollment },
  washExecution: {
    washExecutionId: pendingExample.washExecutionId,
    status: 'IN_PROGRESS',
    executionVersion: 4,
    activeResourceAssignment: {
      cabin: { resourceId: candidate.cabinId },
      tank: { resourceId: candidate.tankId },
    },
  },
} as SupervisorExecutionDetail;
describe('ReassignmentWorkflowService', () => {
  let api: jasmine.SpyObj<ReassignmentGateway>;
  let operations: Subject<DurableOperation>;
  let flow: ReassignmentWorkflowService;
  beforeEach(() => {
    sessionStorage.removeItem('estoma.reassignment.receipts.v1');
    api = jasmine.createSpyObj('reassignments', [
      'list',
      'candidates',
      'submit',
      'operation',
      'detail',
    ]);
    operations = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: REASSIGNMENT_GATEWAY, useValue: api },
        { provide: OperationTrackerService, useValue: { trackWith: () => operations } },
      ],
    });
    TestBed.inject(SessionStore).session.set({
      accountId: 'test',
      sessionId: 's',
      accessToken: 'secret',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    api.submit.and.returnValue(
      of({
        operationId: 'op',
        status: 'PENDING',
        pollPath: '/api/v1/operations/op',
        submittedAt: new Date().toISOString(),
      }),
    );
    api.detail.and.returnValue(of(result));
    flow = TestBed.inject(ReassignmentWorkflowService);
  });
  afterEach(() => sessionStorage.removeItem('estoma.reassignment.receipts.v1'));
  it('keeps the same idempotency key and payload after an ambiguous network failure', fakeAsync(() => {
    api.submit.and.returnValue(throwError(() => new Error('lost response')));
    flow.start(pendingExample, candidate);
    flushMicrotasks();
    const first = api.submit.calls.mostRecent().args[0];
    flow.start(pendingExample, candidateExamples[1]);
    void flow.resume();
    flushMicrotasks();
    expect(api.submit.calls.mostRecent().args[0]).toEqual(first);
    expect(flow.pending()).not.toBeNull();
    expect(sessionStorage.getItem('estoma.reassignment.receipts.v1')).not.toContain('secret');
  }));
  it('waits for a terminal operation and matching assignment before showing success', fakeAsync(() => {
    flow.start(pendingExample, candidate);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'PENDING' });
    flushMicrotasks();
    expect(flow.busy()).toBeTrue();
    expect(flow.completed()).toBeNull();
    operations.next({ operationId: 'op', status: 'SUCCEEDED', data: { status: 'IN_PROGRESS' } });
    flushMicrotasks();
    expect(flow.pending()).toBeNull();
    expect(flow.completed()).toEqual(result);
  }));
  it('retains an inconclusive operation and blocks another command', fakeAsync(() => {
    api.detail.and.returnValue(
      of({ ...result, washExecution: { ...result.washExecution, status: 'PENDING_REASSIGNMENT' } }),
    );
    flow.start(pendingExample, candidate);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    flushMicrotasks();
    flow.start(pendingExample, candidateExamples[1]);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(flow.pending()?.operationId).toBe('op');
    expect(flow.completed()).toBeNull();
  }));
  it('clears a rejected intent so a conflict requires a new explicit selection', fakeAsync(() => {
    flow.start(pendingExample, candidate);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'REJECTED', errorCode: 'VERSION_CONFLICT' });
    flushMicrotasks();
    expect(flow.pending()).toBeNull();
    expect(flow.error()).toContain('cambió');
    expect(flow.completed()).toBeNull();
  }));
  it('requires a cancellation reason and sends the documented cancellation subreason', fakeAsync(() => {
    flow.start(pendingExample, null, ' ');
    expect(api.submit).not.toHaveBeenCalled();
    flow.start(pendingExample, null, ' Sin espacio ');
    flushMicrotasks();
    expect(api.submit.calls.mostRecent().args[0].body).toEqual({
      expectedVersion: 3,
      cancellationSubreason: 'CAPACITY_LOSS',
      cancellationReason: 'Sin espacio',
    });
    operations.next({ operationId: 'op', status: 'REJECTED' });
    flushMicrotasks();
  }));
  for (const status of [400, 403, 422]) {
    it(`retains an earlier uncertain intent when a retry returns ${status} (HTTP ${status})`, fakeAsync(() => {
      api.submit.and.returnValue(throwError(() => new Error('response lost')));
      flow.start(pendingExample, candidate);
      flushMicrotasks();
      const original = api.submit.calls.mostRecent().args[0];
      api.submit.and.returnValue(
        throwError(() => new ApplicationError('forbidden', 'Access changed', status)),
      );
      const restored = TestBed.runInInjectionContext(() => new ReassignmentWorkflowService());
      void restored.resume();
      flushMicrotasks();
      expect(api.submit.calls.mostRecent().args[0]).toEqual(original);
      expect(restored.pending()?.command).toEqual(original);
    }));
  }
  it('reconciles clinic cancellation with the exact execution, including after tracking expires', fakeAsync(() => {
    const cancelled = {
      ...result,
      appointment: { ...result.appointment, appointmentStatus: 'CANCELLED' },
      washExecution: {
        ...result.washExecution,
        status: 'CANCELLED',
        activeResourceAssignment: null,
      },
    };
    api.detail.and.returnValue(of(cancelled));
    flow.start(pendingExample, null, 'Sin capacidad disponible');
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    flushMicrotasks();
    expect(api.detail).toHaveBeenCalledWith(pendingExample.washExecutionId);
    expect(flow.completed()).toEqual(cancelled);
    expect(flow.pending()).toBeNull();
    expect(api.submit).toHaveBeenCalledTimes(1);
  }));
});
