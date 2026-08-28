import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import { AppointmentAvailability } from '../domain/models/appointment-registration';
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

  beforeEach(async () => {
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
});
