import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  AvailabilityRequest,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../domain/models/appointment-registration';
import { WASH_APPOINTMENTS_GATEWAY } from '../domain/ports/wash-appointments.gateway';

@Injectable({ providedIn: 'root' })
export class WashAppointmentRegistrationUseCase {
  private readonly gateway = inject(WASH_APPOINTMENTS_GATEWAY);

  getFormContext(): Observable<AppointmentFormContext> {
    return this.gateway.getFormContext();
  }

  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability> {
    return this.gateway.getAvailability(request);
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    return this.gateway.schedule(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
