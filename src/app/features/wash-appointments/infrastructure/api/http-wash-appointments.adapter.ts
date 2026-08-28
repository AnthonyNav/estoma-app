import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
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
    return this.http.get<AppointmentFormContext>(`${this.baseUrl}/form-context`);
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

    return this.http.get<AppointmentAvailability>(`${this.baseUrl}/availability`, { params });
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(this.baseUrl, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(`${environment.apiBaseUrl}/operations/${operationId}`);
  }
}
