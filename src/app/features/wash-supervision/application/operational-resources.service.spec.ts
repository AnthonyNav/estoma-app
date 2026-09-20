import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessionStore } from '../../authentication/application/session-store.service';
import { OperationalResourcesService, OperationalResource } from './operational-resources.service';

describe('Operational resources', () => {
  const storage = 'estoma.operational-resources.receipts.v1';
  const url = '/api/v1/wash/operational-resources';
  const resource: OperationalResource = {
    resourceId: '11111111-1111-1111-1111-111111111111',
    resourceType: 'CABIN',
    code: 'C1',
    name: 'Cabina 1',
    administrativeStatus: 'ACTIVE',
    unavailabilities: [],
  };
  let flow: OperationalResourcesService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.removeItem(storage);
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
    flow = TestBed.inject(OperationalResourcesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem(storage);
  });
  function load() {
    void flow.load();
    http.expectOne(url).flush({ resources: [resource] });
    flushMicrotasks();
  }
  it('persists before sending and retries an uncertain response using the original key', fakeAsync(() => {
    load();
    flow.start(flow.resources()[0], 'Fuga');
    const first = http.expectOne(url + '/disable');
    const key = first.request.headers.get('Idempotency-Key');
    expect(localStorage.getItem(storage)).toContain(key!);
    expect(localStorage.getItem(storage)).not.toContain('secret');
    first.error(new ProgressEvent('network'));
    flushMicrotasks();
    expect(flow.pending()).not.toBeNull();
    void flow.resume();
    const retry = http.expectOne(url + '/disable');
    expect(retry.request.headers.get('Idempotency-Key')).toBe(key);
    expect(retry.request.body).toEqual({
      cabinId: resource.resourceId,
      causeType: 'MANUAL_DISABLE',
      reason: 'Fuga',
    });
    retry.error(new ProgressEvent('network'));
    flushMicrotasks();
  }));
  it('requires a listed resource and meaningful bounded reasons', fakeAsync(() => {
    load();
    flow.start({ ...resource }, 'Fuga');
    flow.start(flow.resources()[0], '   ');
    flow.start(flow.resources()[0], 'x'.repeat(501));
    http.expectNone(url + '/disable');
    expect(flow.pending()).toBeNull();
  }));
  it('restores the selected unavailability using its aggregate version', fakeAsync(() => {
    void flow.load();
    http.expectOne(url).flush({
      resources: [
        {
          ...resource,
          unavailabilities: [
            {
              resourceUnavailabilityId: '22222222-2222-2222-2222-222222222222',
              reason: 'Fuga',
              expectedVersion: 7,
            },
          ],
        },
      ],
    });
    flushMicrotasks();
    const row = flow.resources()[0];
    flow.start(row, 'Reparada', row.unavailabilities[0]);
    const request = http.expectOne(url + '/restore');
    expect(request.request.body).toEqual({
      resourceUnavailabilityId: row.unavailabilities[0].resourceUnavailabilityId,
      expectedVersion: 7,
      resolution: 'Reparada',
    });
    request.error(new ProgressEvent('network'));
    flushMicrotasks();
  }));
  it('fails closed when reading incomplete projections', fakeAsync(() => {
    void flow.load();
    http.expectOne(url).flush({ resources: [{ ...resource, name: null }] });
    flushMicrotasks();
    expect(flow.loaded()).toBeFalse();
    expect(flow.resources()).toEqual([]);
  }));
  it('retains a successful receipt until the projection includes its exact unavailability', fakeAsync(() => {
    load();
    flow.start(flow.resources()[0], 'Fuga');
    const operationId = '33333333-3333-3333-3333-333333333333';
    const unavailableId = '22222222-2222-2222-2222-222222222222';
    http.expectOne(url + '/disable').flush({
      operationId,
      status: 'PENDING',
      pollPath: '/api/v1/operations/' + operationId,
      submittedAt: '2026-09-19T12:00:00Z',
    });
    flushMicrotasks();
    tick(0);
    http.expectOne('/api/v1/operations/' + operationId).flush({
      operationId,
      status: 'SUCCEEDED',
      data: { resourceUnavailabilityId: unavailableId },
    });
    flushMicrotasks();
    http.expectOne(url).flush({ resources: [resource] });
    flushMicrotasks();
    expect(flow.pending()).not.toBeNull();
    void flow.resume();
    tick(0);
    http.expectNone(url + '/disable');
    http.expectOne('/api/v1/operations/' + operationId).flush({
      operationId,
      status: 'SUCCEEDED',
      data: { resourceUnavailabilityId: unavailableId },
    });
    flushMicrotasks();
    http.expectOne(url).flush({
      resources: [
        {
          ...resource,
          unavailabilities: [
            { resourceUnavailabilityId: unavailableId, reason: 'Fuga', expectedVersion: 1 },
          ],
        },
      ],
    });
    flushMicrotasks();
    expect(flow.pending()).toBeNull();
  }));
});
