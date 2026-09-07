import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import {
  validateContext,
  validateAvailability,
  validateAccepted,
  validateOperation,
} from './booking-validation';

import { environment } from '../../../../../environments/environment';
import {
  CancelAppointmentCommand,
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  AvailabilityRequest,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../../domain/models/appointment-registration';
import { WashAppointmentsGateway } from '../../domain/ports/wash-appointments.gateway';

@Injectable()
export class HttpWashAppointmentsAdapter implements WashAppointmentsGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/wash/appointments`;

  getFormContext(): Observable<AppointmentFormContext> {
    return this.http
      .get<AppointmentFormContext>(`${this.baseUrl}/form-context`)
      .pipe(timeout(15000), map(validateContext));
  }

  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability> {
    const params = new HttpParams({
      fromObject: {
        appointmentType: request.appointmentType,
        instrumentCount: String(request.instrumentCount),
        pieceType: request.pieceType,
        courseSectionId: request.courseSectionId,
      },
    });

    return this.http
      .get<AppointmentAvailability>(`${this.baseUrl}/availability`, { params })
      .pipe(timeout(15000), map(validateAvailability));
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(this.baseUrl, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(timeout(15000), map(validateAccepted));
  }

  cancel(command: CancelAppointmentCommand): Observable<AcceptedOperation> {
    const { appointmentId, idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(
        `${this.baseUrl}/${encodeURIComponent(appointmentId)}/cancel`,
        body,
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(timeout(15000), map(validateAccepted));
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http
      .get<DurableOperation>(
        `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
      )
      .pipe(
        timeout(15000),
        map((value) => validateOperation(value, operationId)),
      );
  }
}
