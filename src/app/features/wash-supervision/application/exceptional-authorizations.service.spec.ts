import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  OperationResult,
  OperationTrackerService,
} from '../../../core/api/operation-tracker.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { ExceptionalAuthorizationsService } from './exceptional-authorizations.service';

describe('ExceptionalAuthorizationsService', () => {
  let flow: ExceptionalAuthorizationsService;
  let http: HttpTestingController;
  let results: Subject<OperationResult>;
  const key = 'estoma.exceptional-authorizations.receipts.v1';
  const url = '/api/v1/wash/exceptional-authorizations';
  const operationId = '11111111-1111-1111-1111-111111111111';
  const accepted = {
    operationId,
    status: 'PENDING',
    pollPath: `/api/v1/operations/${operationId}`,
    submittedAt: '2026-09-19T16:00:00Z',
  };
  beforeEach(() => {
    localStorage.removeItem(key);
    results = new Subject();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OperationTrackerService, useValue: { trackWith: () => results } },
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
    http = TestBed.inject(HttpTestingController);
    flow = TestBed.inject(ExceptionalAuthorizationsService);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem(key);
  });
  it('persists before sending and reuses the exact key and payload after a lost response', () => {
    flow.grant('student', '2026-09-19', 'Additional instruments');
    const first = http.expectOne(url);
    const request = first.request;
    expect(localStorage.getItem(key)).toContain(request.headers.get('Idempotency-Key')!);
    expect(localStorage.getItem(key)).not.toContain('secret');
    first.error(new ProgressEvent('network'));
    flow = TestBed.runInInjectionContext(() => new ExceptionalAuthorizationsService());
    flow.grant('other-student', '2026-09-20', 'Different intent');
    http.expectNone(url);
    flow.resume();
    const retry = http.expectOne(url);
    expect(retry.request.body).toEqual(request.body);
    expect(retry.request.headers.get('Idempotency-Key')).toEqual(
      request.headers.get('Idempotency-Key'),
    );
    retry.flush(accepted);
  });
  it('retains uncertain terminal outcomes and permits acknowledgement only of confirmed results', () => {
    flow.cancel('authorization', 'No longer needed');
    http.expectOne(`${url}/authorization/cancel`).flush(accepted);
    results.next({ operationId: 'op', status: 'FAILED' });
    flow.acknowledge();
    expect(flow.pending()?.operationId).toBe(operationId);
    flow.resume();
    http.expectNone(`${url}/authorization/cancel`);
    results.next({ operationId: 'op', status: 'SUCCEEDED' });
    flow.acknowledge();
    expect(flow.pending()).toBeNull();
  });
  it('isolates durable receipts by supervisor account', () => {
    flow.grant('student', '2026-09-19', 'Reason');
    http.expectOne(url).error(new ProgressEvent('network'));
    const session = TestBed.inject(SessionStore);
    session.session.set({ ...session.session()!, accountId: 'another-supervisor' });
    expect(flow.pending()).toBeNull();
    flow.resume();
    http.expectNone(url);
  });
  it('does not send a command when receipt storage fails', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    flow.grant('student', '2026-09-19', 'Reason');
    http.expectNone(url);
    expect(flow.message()).toContain('almacenamiento');
  });
});
