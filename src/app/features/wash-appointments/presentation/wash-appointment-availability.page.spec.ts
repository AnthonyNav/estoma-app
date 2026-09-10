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

interface AvailabilityPageInternals {
  lastRefreshAt: number;
  loadAvailability(): void;
  scheduleAvailabilityRefresh(): void;
}

const internals = (page: WashAppointmentAvailabilityPage): AvailabilityPageInternals =>
  page as unknown as AvailabilityPageInternals;

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
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      availableCapacity: 2,
      bookingDeadlineAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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

  it('removes a selected slot at its booking deadline and blocks confirmation', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-10T14:00:00Z'));
    try {
      const fixture = TestBed.createComponent(WashAppointmentAvailabilityPage);
      const page = fixture.componentInstance;
      const expiringAvailability: AppointmentAvailability = {
        ...availability,
        availableTimeSlots: [
          {
            ...availability.availableTimeSlots[0],
            bookingDeadlineAt: '2026-09-10T14:00:01Z',
          },
        ],
      };
      page.availability.set(expiringAvailability);
      page.selectTimeSlot(expiringAvailability.availableTimeSlots[0]);
      internals(page).scheduleAvailabilityRefresh();

      jasmine.clock().tick(1000);

      expect(page.availableTimeSlots()).toEqual([]);
      expect(registration.selectedTimeSlot()).toBeNull();
      expect(page.canSchedule()).toBeFalse();
      page.confirmSchedule();
      expect(appointmentRegistration.schedule).not.toHaveBeenCalled();
      fixture.destroy();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('refreshes once when the page returns to the foreground', () => {
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
    const initialRequests = appointmentRegistration.getAvailability.calls.count();
    internals(page).lastRefreshAt = 0;

    page.refreshOnFocus();
    page.refreshOnVisibilityChange();

    expect(appointmentRegistration.getAvailability.calls.count()).toBe(initialRequests + 1);
  });

  it('refreshes at the next Mexico City midnight', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-11T05:59:59Z'));
    try {
      const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
      page.availability.set({
        ...availability,
        availableTimeSlots: [
          {
            ...availability.availableTimeSlots[0],
            bookingDeadlineAt: '2026-09-12T14:00:00Z',
          },
        ],
      });
      const initialRequests = appointmentRegistration.getAvailability.calls.count();
      internals(page).scheduleAvailabilityRefresh();

      jasmine.clock().tick(1000);

      expect(appointmentRegistration.getAvailability.calls.count()).toBe(initialRequests + 1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not issue another POST while a durable operation is pending', () => {
    const tracker = TestBed.inject(OperationTrackerService);
    (tracker.trackWith as jasmine.Spy).and.returnValue(new Subject<DurableOperation>());
    registration.beginSchedule({
      ...registration.draft(),
      appointmentTimeSlotId: 'slot-1',
      exceptionalAuthorizationId: null,
      idempotencyKey: 'durable-key',
    });
    registration.setScheduleOperation('operation-1');
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;

    page.confirmSchedule();

    expect(appointmentRegistration.schedule).not.toHaveBeenCalled();
    expect(tracker.trackWith).toHaveBeenCalledTimes(1);
  });

  it('does not let an existing expiry timer alter a durable pending request', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-10T14:00:00Z'));
    try {
      const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
      const slot = {
        ...availability.availableTimeSlots[0],
        bookingDeadlineAt: '2026-09-10T14:00:01Z',
      };
      page.availability.set({ ...availability, availableTimeSlots: [slot] });
      page.selectTimeSlot(slot);
      internals(page).scheduleAvailabilityRefresh();
      registration.beginSchedule({
        ...registration.draft(),
        appointmentTimeSlotId: slot.appointmentTimeSlotId,
        exceptionalAuthorizationId: null,
        idempotencyKey: 'durable-key',
      });

      jasmine.clock().tick(1000);

      expect(registration.selectedTimeSlot()?.appointmentTimeSlotId).toBe(
        slot.appointmentTimeSlotId,
      );
      expect(registration.pendingSchedule()?.command.idempotencyKey).toBe('durable-key');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('ignores an older availability response after a newer refresh starts', () => {
    const first = new Subject<AppointmentAvailability>();
    const second = new Subject<AppointmentAvailability>();
    appointmentRegistration.getAvailability.and.returnValues(first, second);
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;

    internals(page).loadAvailability();
    second.next({ ...availability, canSchedule: false });
    first.next(availability);

    expect(page.availability()?.canSchedule).toBeFalse();
  });

  it('does not display availability that arrived for a previous session', () => {
    const response = new Subject<AppointmentAvailability>();
    appointmentRegistration.getAvailability.and.returnValue(response);
    const page = TestBed.createComponent(WashAppointmentAvailabilityPage).componentInstance;
    const session = TestBed.inject(SessionStore);
    session.session.update((current) => ({ ...current!, accountId: 'another-account' }));

    response.next(availability);

    expect(page.availability()).toBeNull();
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
