import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpSupervisorExitAdapter } from './http-supervisor-exit.adapter';
import { environment } from '../../../../environments/environment';
import { emptyMaterials } from '../domain/student-exit';
describe('Supervisor exit HTTP contract', () => {
  it('accepts historical closures without submitted materials but rejects missing final materials', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpSupervisorExitAdapter],
    });
    const api = TestBed.inject(HttpSupervisorExitAdapter);
    const http = TestBed.inject(HttpTestingController);
    const id = '44444444-4444-4444-4444-444444444444';
    const detail = {
      student: { displayName: 'Ana' },
      appointment: { appointmentId: 'appointment', appointmentStatus: 'COMPLETED' },
      washExecution: {
        washExecutionId: id,
        executionVersion: 4,
        status: 'COMPLETED',
        completedAt: '2026-09-06T20:00:00Z',
        submittedExitMaterials: null,
        finalExitMaterials: { ...emptyMaterials(), packageCount: 2 },
        activeResourceAssignment: null,
        lastResourceAssignment: { cabin: { code: '107' }, tank: { code: 'B' } },
      },
    };
    const success = jasmine.createSpy('success'),
      failure = jasmine.createSpy('failure');
    api.detail(id).subscribe({ next: success, error: failure });
    http.expectOne(`${environment.apiBaseUrl}/wash/supervision/executions/${id}`).flush(detail);
    expect(success).toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    api.detail(id).subscribe({ error: failure });
    http.expectOne(`${environment.apiBaseUrl}/wash/supervision/executions/${id}`).flush({
      ...detail,
      washExecution: { ...detail.washExecution, finalExitMaterials: null },
    });
    expect(failure).toHaveBeenCalled();
    http.verify();
  });
  it('sends complete final quantities, execution version and idempotency key without entry flags', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpSupervisorExitAdapter],
    });
    const api = TestBed.inject(HttpSupervisorExitAdapter),
      http = TestBed.inject(HttpTestingController);
    const finalMaterials = { ...emptyMaterials(), packageCount: 2 };
    api
      .complete({
        washExecutionId: '44444444-4444-4444-4444-444444444444',
        expectedVersion: 3,
        finalMaterials,
        idempotencyKey: 'intent',
      })
      .subscribe();
    const req = http.expectOne(
      `${environment.apiBaseUrl}/wash/executions/44444444-4444-4444-4444-444444444444/complete`,
    );
    expect(req.request.body).toEqual({ expectedVersion: 3, finalMaterials });
    expect(req.request.headers.get('Idempotency-Key')).toBe('intent');
    req.flush({
      operationId: '88888888-8888-8888-8888-888888888888',
      status: 'PENDING',
      pollPath: '/api/v1/operations/88888888-8888-8888-8888-888888888888',
      submittedAt: new Date().toISOString(),
    });
    http.verify();
  });
});
