import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CancelAppointmentCommand,
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  AvailabilityRequest,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../models/appointment-registration';

export interface WashAppointmentsGateway {
  getFormContext(): Observable<AppointmentFormContext>;
  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability>;
  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation>;
  cancel(command: CancelAppointmentCommand): Observable<AcceptedOperation>;

  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_APPOINTMENTS_GATEWAY = new InjectionToken<WashAppointmentsGateway>(
  'WASH_APPOINTMENTS_GATEWAY',
);
