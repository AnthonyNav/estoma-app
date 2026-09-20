import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { ExceptionalAuthorizationsService } from './exceptional-authorizations.service';

describe('Exceptional authorization response validation', () => {
  let flow: ExceptionalAuthorizationsService;
  let http: HttpTestingController;
  const key = 'estoma.exceptional-authorizations.receipts.v1';
  const url = '/api/v1/wash/exceptional-authorizations';
  const operationId = '11111111-1111-1111-1111-111111111111';
  const operationUrl = `/api/v1/operations/${operationId}`;
  const accepted = {
    operationId,
    status: 'PENDING',
    pollPath: operationUrl,
    submittedAt: '2026-09-19T16:00:00Z',
  };
  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
  it('rejects malformed acceptance without polling undefined or losing its receipt', fakeAsync(() => {
    flow.grant('student', '2026-09-19', 'Reason');
    const first = http.expectOne(url);
    const originalKey = first.request.headers.get('Idempotency-Key');
    first.flush({ status: 'PENDING' });
    tick(0);
    http.expectNone((request) => request.method === 'GET');
    expect(flow.busy()).toBeFalse();
    expect(flow.pending()?.operationId).toBeUndefined();
    flow.resume();
    const retry = http.expectOne(url);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(originalKey);
    retry.error(new ProgressEvent('network'));
  }));
  it('times out a lost acceptance and keeps the original receipt retryable', fakeAsync(() => {
    flow.grant('student', '2026-09-19', 'Reason');
    const request = http.expectOne(url);
    tick(15001);
    expect(request.cancelled).toBeTrue();
    expect(flow.busy()).toBeFalse();
    expect(flow.pending()).not.toBeNull();
  }));
  it('rejects a mismatched operation and times out a stalled operation poll', fakeAsync(() => {
    flow.grant('student', '2026-09-19', 'Reason');
    http.expectOne(url).flush(accepted);
    tick(0);
    http.expectOne(operationUrl).flush({ operationId: 'other', status: 'SUCCEEDED' });
    expect(flow.busy()).toBeFalse();
    expect(flow.pending()?.status).toBeUndefined();
    flow.resume();
    tick(0);
    const stalled = http.expectOne(operationUrl);
    tick(15001);
    expect(stalled.cancelled).toBeTrue();
    expect(flow.busy()).toBeFalse();
    expect(flow.pending()?.operationId).toBe(operationId);
  }));
  it('rejects malformed lists and student identities', () => {
    const failed = jasmine.createSpy('failed');
    flow.search('Alumno').subscribe({ error: failed });
    http
      .expectOne((request) => request.url === `${url}/students`)
      .flush([{ accountId: 'invalid', enrollment: '123', fullName: 'Alumno' }]);
    flow.list('student', '2026-09-19').subscribe({ error: failed });
    http
      .expectOne((request) => request.url === url)
      .flush([
        { authorizationId: operationId, status: 'CONSUMED', reason: 'Reason', canCancel: true },
      ]);
    expect(failed).toHaveBeenCalledTimes(2);
  });
  it('cancels reads and accepted-response waits when the session ends', () => {
    const received = jasmine.createSpy('received');
    flow.search('Alumno').subscribe(received);
    const search = http.expectOne((request) => request.url === `${url}/students`);
    flow.grant('student', '2026-09-19', 'Reason');
    const command = http.expectOne(url);
    TestBed.inject(SessionLifecycleService).end();
    expect(search.cancelled).toBeTrue();
    expect(command.cancelled).toBeTrue();
    expect(received).not.toHaveBeenCalled();
    expect(flow.busy()).toBeFalse();
  });
});
