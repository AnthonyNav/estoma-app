import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
import { StudentWashHome } from '../../domain/models/student-wash-home';
import {
  CancelStudentAppointmentCommand,
  StudentWashHomeGateway,
  SubmitStudentExitCommand,
} from '../../domain/ports/student-wash-home.gateway';

@Injectable()
export class HttpStudentWashHomeAdapter implements StudentWashHomeGateway {
  private readonly http = inject(HttpClient);

  loadHome(): Observable<StudentWashHome> {
    return this.http.get<StudentWashHome>(`${environment.apiBaseUrl}/wash/student/home`);
  }

  cancelAppointment(command: CancelStudentAppointmentCommand): Observable<AcceptedOperation> {
    const { appointmentId, idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(
      `${environment.apiBaseUrl}/wash/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      body,
      { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
    );
  }

  submitExit(command: SubmitStudentExitCommand): Observable<AcceptedOperation> {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(
      `${environment.apiBaseUrl}/wash/executions/${encodeURIComponent(washExecutionId)}/exit`,
      body,
      { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
    );
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(
      `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
    );
  }
}
