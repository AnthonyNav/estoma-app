import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../wash-appointments/domain/models/appointment-registration';
import {
  validateAccepted,
  validateOperation,
} from '../../wash-appointments/infrastructure/api/booking-validation';
import { StudentExitCommand, StudentExitGateway } from '../domain/student-exit';
@Injectable()
export class HttpStudentExitAdapter implements StudentExitGateway {
  private readonly http = inject(HttpClient);
  submit(command: StudentExitCommand) {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(
        `${environment.apiBaseUrl}/wash/executions/${encodeURIComponent(washExecutionId)}/exit`,
        body,
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(timeout(15000), map(validateAccepted));
  }
  operation(id: string) {
    return this.http
      .get<DurableOperation>(`${environment.apiBaseUrl}/operations/${encodeURIComponent(id)}`)
      .pipe(
        timeout(15000),
        map((value) => validateOperation(value, id)),
      );
  }
}
