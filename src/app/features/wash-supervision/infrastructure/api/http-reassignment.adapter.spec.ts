import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpReassignmentAdapter } from './http-reassignment.adapter';
import { environment } from '../../../../../environments/environment';
import { candidateExamples, pendingExample } from '../mock/reassignment.fixtures';
describe('HttpReassignmentAdapter', () => {
  let api: HttpReassignmentAdapter;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/wash/supervision/pending-reassignments`;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpReassignmentAdapter],
    });
    api = TestBed.inject(HttpReassignmentAdapter);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('preserves list order and does not hide rows with missing projection data', () => {
    const incomplete = { ...pendingExample, student: null, appointment: null };
    api.list().subscribe((rows) => expect(rows).toEqual([incomplete, pendingExample]));
    http.expectOne(url).flush({ items: [incomplete, pendingExample] });
  });
  it('does not interpret a 503 as an empty candidate list', () => {
    const success = jasmine.createSpy('success');
    const failure = jasmine.createSpy('failure');
    api.candidates(pendingExample.washExecutionId).subscribe({ next: success, error: failure });
    http
      .expectOne(`${url}/${pendingExample.washExecutionId}/candidates`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    expect(success).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalled();
  });
  it('sends the selected cabin and tank atomically with version and idempotency header', () => {
    const choice = candidateExamples[0];
    const body = { cabinId: choice.cabinId, tankId: choice.tankId, expectedVersion: 3 };
    api
      .submit({ washExecutionId: pendingExample.washExecutionId, idempotencyKey: 'same-key', body })
      .subscribe();
    const request = http.expectOne(
      `${environment.apiBaseUrl}/wash/executions/${pendingExample.washExecutionId}/reassignment`,
    );
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-key');
    request.flush({
      operationId: '88888888-8888-8888-8888-888888888888',
      status: 'PENDING',
      pollPath: '/api/v1/operations/88888888-8888-8888-8888-888888888888',
      submittedAt: new Date().toISOString(),
    });
  });
});
