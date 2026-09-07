import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../../environments/environment';
import { HttpWashSupervisionAdapter } from './http-wash-supervision.adapter';
import { validateSupervisorLookup } from './supervisor-lookup.validation';
import examples from '../../testing/entry-responses.fixture.json';
import { SupervisorEntryLookup } from '../../domain/models/supervisor-entry';
describe('Supervisor HTTP contract', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpWashSupervisionAdapter],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('reads the five home counters and pending assignments without a mutation key', () => {
    const home = {
      serviceDate: '2026-09-06',
      pendingReassignmentsCount: 2,
      summary: {
        registeredAppointments: 12,
        inProcessAppointments: 5,
        completedAppointments: 4,
        deniedAppointments: 1,
        cancelledAppointments: 0,
      },
    };
    let received: unknown;
    TestBed.inject(HttpWashSupervisionAdapter)
      .getHome()
      .subscribe((value) => (received = value));
    const req = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiBaseUrl}/wash/supervision/home`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
    req.flush(home);
    expect(received).toEqual(home);
  });
  it('does not display missing counters as zero', () => {
    let failed = false;
    TestBed.inject(HttpWashSupervisionAdapter)
      .getHome()
      .subscribe({ error: () => (failed = true) });
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiBaseUrl}/wash/supervision/home`)
      .flush({ serviceDate: '2026-09-06', pendingReassignmentsCount: 0, summary: {} });
    expect(failed).toBeTrue();
  });
  it('uses the deployed lookup route and keeps the exact DTO', () => {
    let name = '';
    TestBed.inject(HttpWashSupervisionAdapter)
      .lookup({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: 'E2E-ALUMNO-01' })
      .subscribe((value) => (name = value.student.displayName));
    const req = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiBaseUrl}/wash/supervision/lookup`,
    );
    expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
    req.flush(examples.lookupBeforeArrival);
    expect(name).toBe('Alumno Sintético');
  });
  it('routes arrival and decision to executions and excludes path/key from bodies', () => {
    const adapter = TestBed.inject(HttpWashSupervisionAdapter);
    const http = TestBed.inject(HttpTestingController);
    adapter
      .registerArrival({ appointmentId: 'appointment', idempotencyKey: 'arrival-key' })
      .subscribe({ error: () => undefined });
    const arrival = http.expectOne(`${environment.apiBaseUrl}/wash/executions/arrivals`);
    expect(arrival.request.body).toEqual({ appointmentId: 'appointment' });
    expect(arrival.request.headers.get('Idempotency-Key')).toBe('arrival-key');
    arrival.flush({}, { status: 503, statusText: 'Unavailable' });
    adapter
      .decideEntry({
        washExecutionId: 'execution',
        expectedVersion: 4,
        decision: 'AUTHORIZED',
        identityConfirmed: true,
        requirementsSatisfied: true,
        rejectionReason: null,
        idempotencyKey: 'decision-key',
      })
      .subscribe({ error: () => undefined });
    const decision = http.expectOne(
      `${environment.apiBaseUrl}/wash/executions/execution/entry-decision`,
    );
    expect(decision.request.body).toEqual({
      expectedVersion: 4,
      decision: 'AUTHORIZED',
      identityConfirmed: true,
      requirementsSatisfied: true,
      rejectionReason: null,
    });
    expect(decision.request.headers.get('Idempotency-Key')).toBe('decision-key');
    decision.flush({}, { status: 503, statusText: 'Unavailable' });
  });
  it('accepts supplied contract examples and rejects a missing execution version', () => {
    for (const key of [
      'lookupBeforeArrival',
      'lookupAfterAuthorized',
      'lookupAfterRejected',
      'lookupWithoutResources',
    ] as const)
      expect(() => validateSupervisorLookup(examples[key] as SupervisorEntryLookup)).not.toThrow();
    const malformed = structuredClone(
      examples.lookupAfterAuthorized,
    ) as unknown as SupervisorEntryLookup;
    malformed.washExecution!.executionVersion = undefined as unknown as number;
    expect(() => validateSupervisorLookup(malformed)).toThrow();
  });
});
