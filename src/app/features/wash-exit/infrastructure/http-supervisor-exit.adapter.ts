import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApplicationError } from '../../../core/api/application-error';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../wash-supervision/domain/models/supervisor-entry';
import {
  invalidBookingResponse,
  validateAccepted,
  validateOperation,
} from '../../wash-appointments/infrastructure/api/booking-validation';
import {
  CompleteExitCommand,
  SupervisorExecutionDetail,
  SupervisorExitGateway,
} from '../domain/supervisor-exit';
import { validMaterials } from '../domain/student-exit';
@Injectable()
export class HttpSupervisorExitAdapter implements SupervisorExitGateway {
  private readonly http = inject(HttpClient);
  complete(command: CompleteExitCommand) {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(
        `${environment.apiBaseUrl}/wash/executions/${encodeURIComponent(washExecutionId)}/complete`,
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
  detail(id: string) {
    if (!environment.enableSupervisorExecutionRead)
      return throwError(
        () =>
          new ApplicationError(
            'temporary',
            'La consulta exacta del cierre todavía no está habilitada en este entorno.',
            503,
            'EXACT_READ_NOT_ENABLED',
          ),
      );
    return this.http
      .get<SupervisorExecutionDetail>(
        `${environment.apiBaseUrl}/wash/supervision/executions/${encodeURIComponent(id)}`,
      )
      .pipe(
        timeout(15000),
        map((value) => {
          const execution = value?.washExecution;
          if (
            !value?.student?.displayName ||
            (value.canComplete !== undefined && typeof value.canComplete !== 'boolean') ||
            !value.appointment?.appointmentId ||
            execution?.washExecutionId !== id ||
            !Number.isInteger(execution.executionVersion) ||
            execution.executionVersion <= 0
          )
            return invalidBookingResponse();
          if (
            execution.status === 'COMPLETED' &&
            (!validMaterials(execution.finalExitMaterials) ||
              (execution.submittedExitMaterials != null &&
                !validMaterials(execution.submittedExitMaterials)) ||
              !execution.completedAt ||
              !Number.isFinite(Date.parse(execution.completedAt)) ||
              execution.activeResourceAssignment !== null ||
              !execution.lastResourceAssignment?.cabin ||
              !execution.lastResourceAssignment.tank)
          )
            return invalidBookingResponse();
          return value;
        }),
      );
  }
}
