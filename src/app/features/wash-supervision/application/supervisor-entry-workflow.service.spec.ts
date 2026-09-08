import { ApplicationError } from '../../../core/api/application-error';
import { SUPERVISOR_EXIT_GATEWAY } from '../../wash-exit/domain/supervisor-exit';
import { TestBed } from '@angular/core/testing';
import { map, of, Subject, throwError } from 'rxjs';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import examples from '../testing/entry-responses.fixture.json';
import { DurableOperation, SupervisorEntryLookup } from '../domain/models/supervisor-entry';
import { SupervisorEntryWorkflowService } from './supervisor-entry-workflow.service';
import { WashEntrySupervisionUseCase } from './wash-entry-supervision.use-case';
const initial = examples.lookupBeforeArrival as SupervisorEntryLookup;
const arrived: SupervisorEntryLookup = {
  ...initial,
  nextAction: 'ENTRY_DECISION',
  washExecution: {
    washExecutionId: '00000000-0000-4000-8000-000000000005',
    status: 'PENDING_ENTRY',
    executionVersion: 4,
    arrivedAt: '2026-09-06T19:55:00Z',
  },
};
const request = { lookupType: 'STUDENT_ENROLLMENT' as const, studentEnrollment: 'E2E-ALUMNO-01' };
describe('SupervisorEntryWorkflowService', () => {
  let api: jasmine.SpyObj<WashEntrySupervisionUseCase>;
  let operations: Subject<DurableOperation>;
  let flow: SupervisorEntryWorkflowService;
  beforeEach(() => {
    sessionStorage.removeItem('estoma.entry.receipts.v2');
    api = jasmine.createSpyObj('api', ['lookup', 'registerArrival', 'decideEntry', 'getOperation']);
    operations = new Subject();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SUPERVISOR_EXIT_GATEWAY,
          useValue: {
            detail: () =>
              api.lookup(request).pipe(
                map((l) => ({
                  student: l.student,
                  appointment: l.appointment,
                  washExecution: {
                    ...l.washExecution,
                    activeResourceAssignment: l.activeResourceAssignment,
                  },
                })),
              ),
          },
        },
        { provide: WashEntrySupervisionUseCase, useValue: api },
        { provide: OperationTrackerService, useValue: { trackWith: () => operations } },
      ],
    });
    TestBed.inject(SessionStore).session.set({
      accountId: 'a',
      sessionId: 's',
      accessToken: 't',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    api.lookup.and.returnValue(of(initial));
    const accepted = of({
      operationId: 'op',
      status: 'PENDING' as const,
      pollPath: '/api/v1/operations/op',
      submittedAt: '',
    });
    api.registerArrival.and.returnValue(accepted);
    api.decideEntry.and.returnValue(accepted);
    flow = TestBed.inject(SupervisorEntryWorkflowService);
    Object.defineProperty(flow, 'freeRejectionEnabled', { value: true, configurable: true });
  });
  afterEach(() => sessionStorage.removeItem('estoma.entry.receipts.v2'));

  it('only registers arrival on approval and retains distinct receipts for the chained decision', () => {
    flow.search(request);
    expect(api.registerArrival).not.toHaveBeenCalled();
    flow.decide('AUTHORIZED', true, true, '');
    const arrival = api.registerArrival.calls.mostRecent().args[0];
    expect(api.decideEntry).not.toHaveBeenCalled();
    api.lookup.and.returnValue(of(arrived));
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    const decision = api.decideEntry.calls.mostRecent().args[0];
    expect(decision.idempotencyKey).not.toBe(arrival.idempotencyKey);
    expect(decision.expectedVersion).toBe(4);
    expect(decision.identityConfirmed).toBeTrue();
    expect(flow.pending()?.arrivalReceipt?.command).toEqual(arrival);
    const stored = JSON.parse(sessionStorage.getItem('estoma.entry.receipts.v2')!)[0][1];
    expect(stored.kind).toBe('DECISION');
    expect(stored.command).toEqual(decision);
    expect(stored.arrivalReceipt.result.status).toBe('SUCCEEDED');
  });
  it('omits unevaluated checks from a reason-only rejection', () => {
    api.lookup.and.returnValue(of(arrived));
    flow.search(request);
    flow.decide('REJECTED', false, false, '  Falta careta  ');
    const command = api.decideEntry.calls.mostRecent().args[0];
    expect(command.rejectionReason).toBe('Falta careta');
    expect(Object.hasOwn(command, 'identityConfirmed')).toBeFalse();
    expect(Object.hasOwn(command, 'requirementsSatisfied')).toBeFalse();
  });
  it('does not register arrival for rejection while its rollout is disabled', () => {
    Object.defineProperty(flow, 'freeRejectionEnabled', { value: false });
    flow.search(request);
    flow.decide('REJECTED', false, false, 'Falta careta');
    expect(api.registerArrival).not.toHaveBeenCalled();
    expect(api.decideEntry).not.toHaveBeenCalled();
    expect(flow.pending()).toBeNull();
  });
  it('keeps PENDING and ambiguous results and blocks another search or arrival', () => {
    flow.search(request);
    flow.arrive();
    operations.next({ operationId: 'op', status: 'PENDING' });
    flow.search({ ...request, studentEnrollment: 'other' });
    flow.arrive();
    expect(api.lookup).toHaveBeenCalledTimes(1);
    expect(api.registerArrival).toHaveBeenCalledTimes(1);
    operations.next({ operationId: 'op', status: 'FAILED' });
    expect(flow.pending()?.operationId).toBe('op');
    expect(flow.canArrive()).toBeFalse();
  });
  it('retries the same command after a lost response', () => {
    api.registerArrival.and.returnValue(throwError(() => new Error('network')));
    flow.search(request);
    flow.arrive();
    flow.resume();
    expect(api.registerArrival.calls.argsFor(0)[0]).toEqual(
      api.registerArrival.calls.argsFor(1)[0],
    );
  });
  it('waits for arrival convergence before enabling decision', () => {
    flow.search(request);
    flow.arrive();
    api.lookup.and.returnValue(of(arrived));
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    expect(flow.pending()).toBeNull();
    expect(flow.canDecide()).toBeTrue();
  });
  for (const [decision, resultName] of [
    ['AUTHORIZED', 'lookupAfterAuthorized'],
    ['REJECTED', 'lookupAfterRejected'],
    ['AUTHORIZED', 'lookupWithoutResources'],
  ] as const) {
    it(`reconciles ${resultName} as a successful decision using the read version`, () => {
      api.lookup.and.returnValue(of(arrived));
      flow.search(request);
      flow.decide(
        decision,
        true,
        decision === 'AUTHORIZED',
        decision === 'REJECTED' ? 'Requisitos no satisfechos' : '',
      );
      expect(api.decideEntry.calls.mostRecent().args[0].expectedVersion).toBe(4);
      const result = structuredClone(examples[resultName]) as SupervisorEntryLookup;
      result.washExecution!.executionVersion = 5;
      api.lookup.and.returnValue(of(result));
      operations.next({
        operationId: 'op',
        status: 'SUCCEEDED',
        data: { status: result.washExecution!.status },
      });
      expect(flow.pending()).toBeNull();
      expect(flow.lookup()?.washExecution?.status).toBe(result.washExecution!.status);
      expect(flow.canDecide()).toBeFalse();
    });
  }
  it('honors nextAction even when execution status looks actionable', () => {
    api.lookup.and.returnValue(of({ ...arrived, nextAction: 'NONE' }));
    flow.search(request);
    flow.decide('AUTHORIZED', true, true, '');
    expect(api.decideEntry).not.toHaveBeenCalled();
  });
  it('refreshes after technical rejection without treating it as entry rejection', () => {
    flow.search(request);
    flow.arrive();
    operations.next({ operationId: 'op', status: 'REJECTED', errorCode: 'ARRIVAL_TOO_EARLY' });
    expect(flow.pending()).toBeNull();
    expect(flow.error()).toContain('ventana');
    expect(flow.lookup()?.washExecution).toBeNull();
  });
  it('isolates receipts by account and stops old callbacks on logout', () => {
    flow.search(request);
    flow.arrive();
    const session = TestBed.inject(SessionStore);
    const original = session.session()!;
    session.clear();
    TestBed.inject(SessionLifecycleService).end();
    session.session.set({ ...original, accountId: 'b' });
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    expect(flow.pending()).toBeNull();
    expect(flow.lookup()).toBeNull();
    session.session.set(original);
    expect(flow.pending()?.operationId).toBe('op');
  });
  it('reconciles a decision when its operation cannot be read', () => {
    api.lookup.and.returnValue(of(arrived));
    flow.search(request);
    flow.decide('AUTHORIZED', true, true, '');
    const result = structuredClone(examples.lookupAfterAuthorized) as SupervisorEntryLookup;
    result.washExecution!.executionVersion = 5;
    api.lookup.and.returnValue(of(result));
    operations.error(new Error('operation not found'));
    expect(flow.pending()).toBeNull();
    expect(flow.authorizedHere()).toBeTrue();
    expect(flow.error()).toBeNull();
    expect(api.decideEntry).toHaveBeenCalledTimes(1);
  });
  it('does not mistake a different decision for successful approval after tracking expires', () => {
    api.lookup.and.returnValue(of(arrived));
    flow.search(request);
    flow.decide('AUTHORIZED', true, true, '');
    const result = structuredClone(examples.lookupAfterRejected) as SupervisorEntryLookup;
    result.washExecution!.executionVersion = 5;
    api.lookup.and.returnValue(of(result));
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    expect(flow.pending()?.operationId).toBe('op');
    expect(flow.authorizedHere()).toBeFalse();
    expect(flow.error()).toContain('pendiente');
  });
  for (const status of [400, 403, 422]) {
    it(`does not discard an uncertain arrival when its retry returns forbidden (HTTP ${status})`, () => {
      api.registerArrival.and.returnValue(throwError(() => new Error('lost response')));
      flow.search(request);
      flow.arrive();
      const original = api.registerArrival.calls.mostRecent().args[0];
      api.registerArrival.and.returnValue(
        throwError(() => new ApplicationError('forbidden', 'Forbidden', status)),
      );
      flow.resume();
      expect(flow.pending()?.command).toEqual(original);
      expect(api.registerArrival.calls.mostRecent().args[0]).toEqual(original);
    });
  }
  for (const status of [400, 403, 422]) {
    it(`preserves an uncertain decision across recreation and HTTP ${status}`, () => {
      api.lookup.and.returnValue(of(arrived));
      api.decideEntry.and.returnValue(throwError(() => new Error('response lost')));
      flow.search(request);
      flow.decide('AUTHORIZED', true, true, '');
      const original = api.decideEntry.calls.mostRecent().args[0];
      api.decideEntry.and.returnValue(
        throwError(() => new ApplicationError('validation', 'Rejected retry', status)),
      );
      const restored = TestBed.runInInjectionContext(() => new SupervisorEntryWorkflowService());
      restored.resume();
      expect(restored.pending()?.command).toEqual(original);
      expect(api.decideEntry.calls.mostRecent().args[0]).toEqual(original);
    });
  }
});
