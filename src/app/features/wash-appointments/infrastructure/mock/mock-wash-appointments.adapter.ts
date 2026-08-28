import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  AvailabilityRequest,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../../domain/models/appointment-registration';
import { WashAppointmentsGateway } from '../../domain/ports/wash-appointments.gateway';
import { MockWashJourneyStore } from '../../../wash-student-home/infrastructure/mock/mock-wash-journey.store';

@Injectable()
export class MockWashAppointmentsAdapter implements WashAppointmentsGateway {
  private readonly journey = inject(MockWashJourneyStore);

  getFormContext(): Observable<AppointmentFormContext> {
    return this.journey.getFormContext();
  }

  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability> {
    return this.journey.getAvailability(request);
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    return this.journey.schedule(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.journey.getOperation(operationId);
  }
}
