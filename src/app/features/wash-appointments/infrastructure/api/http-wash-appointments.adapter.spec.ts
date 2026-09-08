import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpWashAppointmentsAdapter } from './http-wash-appointments.adapter';
import { environment } from '../../../../../environments/environment';

describe('HttpWashAppointmentsAdapter contract', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpWashAppointmentsAdapter],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('sends the idempotency key only as a header and accepts the durable receipt', () => {
    const operationId = '10000000-0000-0000-0000-000000000001';
    let received = '';
    TestBed.inject(HttpWashAppointmentsAdapter)
      .schedule({
        appointmentType: 'NORMAL',
        instrumentCount: 5,
        pieceType: 'HIGH_SPEED',
        courseSectionId: 'course',
        regulationAccepted: true,
        appointmentTimeSlotId: 'slot',
        exceptionalAuthorizationId: null,
        idempotencyKey: 'same-key',
      })
      .subscribe((value) => (received = value.operationId));
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiBaseUrl}/wash/appointments`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-key');
    expect(request.request.body.idempotencyKey).toBeUndefined();
    expect(request.request.body.regulationAccepted).toBeTrue();
    request.flush(
      {
        operationId,
        status: 'PENDING',
        pollPath: `/api/v1/operations/${operationId}`,
        submittedAt: '2026-09-06T12:00:00Z',
      },
      { status: 202, statusText: 'Accepted' },
    );
    expect(received).toBe(operationId);
  });
  it('rejects a receipt pointing to a different operation', () => {
    let rejected = false;
    TestBed.inject(HttpWashAppointmentsAdapter)
      .getOperation('expected')
      .subscribe({ error: () => (rejected = true) });
    TestBed.inject(HttpTestingController)
      .expectOne(`${environment.apiBaseUrl}/operations/expected`)
      .flush({ operationId: 'different', status: 'SUCCEEDED' });
    expect(rejected).toBeTrue();
  });
  it('sends the cancellation version and key without leaking route fields into the body', () => {
    TestBed.inject(HttpWashAppointmentsAdapter)
      .cancel({ appointmentId: 'appointment', expectedVersion: 3, idempotencyKey: 'cancel-key' })
      .subscribe({ error: () => undefined });
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiBaseUrl}/wash/appointments/appointment/cancel`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('cancel-key');
    expect(request.request.body).toEqual({ expectedVersion: 3 });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
  });
});
