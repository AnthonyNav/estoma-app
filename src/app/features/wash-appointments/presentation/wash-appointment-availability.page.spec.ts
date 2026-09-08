import { SessionStore } from '../../authentication/application/session-store.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import {
  AppointmentAvailability,
  DurableOperation,
} from '../domain/models/appointment-registration';
import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';
import { WashAppointmentAvailabilityPage } from './wash-appointment-availability.page';

const availability: AppointmentAvailability = {
  canSchedule: true,
  blockingReasons: [],
  dailyPenaltyPoints: 0,
  dailyCompletedAppointments: 0,
  exceptionalAuthorizationRequired: false,
  exceptionalAuthorizationAvailable: false,
  exceptionalAuthorizationId: null,
  availableTimeSlots: [
    {
      appointmentTimeSlotId: 'slot-1',
      startsAt: '2026-08-28T10:00:00-06:00',
      endsAt: '2026-08-28T11:00:00-06:00',
      availableCapacity: 2,
      bookingDeadlineAt: '2026-08-28T09:45:00-06:00',
    },
  ],
};

describe('WashAppointmentAvailabilityPage', () => {
  let registration: AppointmentRegistrationDraftService;
  let appointmentRegistration: jasmine.SpyObj<WashAppointmentRegistrationUseCase>;

  afterEach(() => sessionStorage.removeItem('estoma.booking.receipts.v1'));
  beforeEach(async () => {
    sessionStorage.removeItem('estoma.booking.receipts.v1');
    appointmentRegistration = jasmine.createSpyObj<WashAppointmentRegistrationUseCase>(
      'WashAppointmentRegistrationUseCase',
      ['getAvailability', 'schedule', 'getOperation'],
    );

    await TestBed.configureTestingModule({
      imports: [WashAppointmentAvailabilityPage],
      providers: [
        provideRouter([]),
        {
          provide: WashAppointmentRegistrationUseCase,
          useValue: appointmentRegistration,
        },
        {
          provide: OperationTrackerService,
          useValue: { trackWith: jasmine.createSpy('trackWith') },
        },
      ],
    }).compileComponents();

    TestBed.inject(SessionStore).session.set({
      accountId: 'booking-test',
      sessionId: 's',
      accessToken: 't',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    registration = TestBed.inject(AppointmentRegistrationDraftService);
    registration.acceptRegulation(true);
    registration.update({
      appointmentType: 'NORMAL',
      instrumentCount: 15,
      pieceType: 'HIGH_SPEED',
      courseSectionId: 'course-1',
    });
    appointmentRegistration.getAvailability.and.returnValue(
      throwError(() => new ApplicationError('network', 'Sin conexión')),
    );
  });

  it('reuses the same idempotency key after an ambiguous scheduling failure', () => {
    appointmentRegistration.schedule.and.returnValue(
      throwError(() => new ApplicationError('network', 'Sin conexión')),
    );
    const fixture = TestBed.createComponent(WashAppointmentAvailabilityPage);
    fixture.detectChanges();

    fixture.componentInstance.availability.set(availability);
    fixture.componentInstance.selectTimeSlot(availability.availableTimeSlots[0]);
    fixture.componentInstance.confirmSchedule();
    fixture.componentInstance.confirmSchedule();

    expect(appointmentRegistration.schedule).toHaveBeenCalledTimes(2);
    expect(appointmentRegistration.schedule.calls.argsFor(1)[0]).toEqual(
      appointmentRegistration.schedule.calls.argsFor(0)[0],
    );
  });
  for (const status of ['FAILED', 'EXPIRED', 'SUCCEEDED'] as const) {
    it(`preserves reconciliation data after ${status}`, () => {
      const operations = new Subject<DurableOperation>();
      const tracker = TestBed.inject(OperationTrackerService);
      (tracker.trackWith as jasmine.Spy).and.returnValue(operations);
      appointmentRegistration.schedule.and.returnValue(
        of({
          operationId: 'operation-1',
          status: 'PENDING',
          pollPath: '/api/v1/operations/operation-1',
          submittedAt: '2026-09-06T12:00:00Z',
        }),
      );
      const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
      page.availability.set(availability);
      page.selectTimeSlot(availability.availableTimeSlots[0]);
      page.confirmSchedule();
      const original = registration.pendingSchedule()?.command;
      operations.next({ operationId: 'operation-1', status: 'PENDING' });
      expect(registration.pendingSchedule()?.command).toEqual(original);
      operations.next({ operationId: 'operation-1', status });
      expect(registration.pendingSchedule()?.result?.status).toBe(status);
      expect(registration.pendingSchedule()?.command).toEqual(original);
      expect(appointmentRegistration.schedule).toHaveBeenCalledTimes(1);
    });
  }

  it('clears a rejected intention and discards the old slot before refreshing availability', () => {
    const tracker = TestBed.inject(OperationTrackerService);
    (tracker.trackWith as jasmine.Spy).and.returnValue(
      of({ operationId: 'operation-1', status: 'REJECTED', errorCode: 'SLOT_CAPACITY_EXCEEDED' }),
    );
    appointmentRegistration.schedule.and.returnValue(
      of({
        operationId: 'operation-1',
        status: 'PENDING',
        pollPath: '/api/v1/operations/operation-1',
        submittedAt: '2026-09-06T12:00:00Z',
      }),
    );
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
    page.availability.set(availability);
    page.selectTimeSlot(availability.availableTimeSlots[0]);
    page.confirmSchedule();
    expect(registration.pendingSchedule()).toBeNull();
    expect(registration.selectedTimeSlot()).toBeNull();
    expect(appointmentRegistration.getAvailability).toHaveBeenCalledTimes(2);
  });

  it('does not submit a slot when the owner blocks scheduling', () => {
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
    page.availability.set({ ...availability, canSchedule: false });
    page.selectTimeSlot(availability.availableTimeSlots[0]);
    page.confirmSchedule();
    expect(appointmentRegistration.schedule).not.toHaveBeenCalled();
  });
  for (const status of [400, 403, 422]) {
    it(`retains a booking whose lost response is followed by a forbidden retry (HTTP ${status})`, () => {
      appointmentRegistration.schedule.and.returnValue(
        throwError(() => new ApplicationError('network', 'Lost response')),
      );
      const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
      page.availability.set(availability);
      page.selectTimeSlot(availability.availableTimeSlots[0]);
      page.confirmSchedule();
      const original = registration.pendingSchedule()!.command;
      appointmentRegistration.schedule.and.returnValue(
        throwError(() => new ApplicationError('forbidden', 'Forbidden', status)),
      );
      page.confirmSchedule();
      expect(registration.pendingSchedule()?.command).toEqual(original);
      expect(appointmentRegistration.schedule.calls.mostRecent().args[0]).toEqual(original);
    });
  }
});
