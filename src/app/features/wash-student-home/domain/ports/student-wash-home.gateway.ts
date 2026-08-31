import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
import { ExitMaterials, StudentWashHome } from '../models/student-wash-home';

export interface CancelStudentAppointmentCommand {
  appointmentId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface SubmitStudentExitCommand {
  washExecutionId: string;
  expectedVersion: number;
  materials: ExitMaterials;
  idempotencyKey: string;
}

export interface StudentWashHomeGateway {
  loadHome(): Observable<StudentWashHome>;
  cancelAppointment(command: CancelStudentAppointmentCommand): Observable<AcceptedOperation>;
  submitExit(command: SubmitStudentExitCommand): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const STUDENT_WASH_HOME_GATEWAY = new InjectionToken<StudentWashHomeGateway>(
  'STUDENT_WASH_HOME_GATEWAY',
);
