import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  DurableOperation,
} from '../../wash-appointments/domain/models/appointment-registration';
import {
  CancelStudentAppointmentCommand,
  STUDENT_WASH_HOME_GATEWAY,
  SubmitStudentExitCommand,
} from '../domain/ports/student-wash-home.gateway';

@Injectable({ providedIn: 'root' })
export class ManageStudentWashLifecycleUseCase {
  private readonly gateway = inject(STUDENT_WASH_HOME_GATEWAY);

  cancelAppointment(command: CancelStudentAppointmentCommand): Observable<AcceptedOperation> {
    return this.gateway.cancelAppointment(command);
  }

  submitExit(command: SubmitStudentExitCommand): Observable<AcceptedOperation> {
    return this.gateway.submitExit(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
