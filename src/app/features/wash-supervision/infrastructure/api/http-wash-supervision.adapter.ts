import { ApplicationError } from '../../../../core/api/application-error';
import { DirectoryQuery, SupervisorDirectory } from '../../domain/models/supervisor-entry';
import { invalidBookingResponse } from '../../../wash-appointments/infrastructure/api/booking-validation';
import { SupervisorHome } from '../../domain/models/supervisor-home';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout, throwError } from 'rxjs';
import { validateSupervisorLookup } from './supervisor-lookup.validation';
import {
  validateAccepted,
  validateOperation,
} from '../../../wash-appointments/infrastructure/api/booking-validation';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../../domain/models/supervisor-entry';
import { WashSupervisionGateway } from '../../domain/ports/wash-supervision.gateway';

@Injectable()
export class HttpWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/wash/supervision`;

  getDirectory(query: DirectoryQuery = {}): Observable<SupervisorDirectory> {
    return this.http
      .get<SupervisorDirectory>(`${this.baseUrl}/appointments`, {
        params: {
          query: query.query ?? '',
          status: query.status ?? 'ALL',
          offset: query.offset ?? 0,
          limit: 25,
        },
      })
      .pipe(
        timeout(15000),
        map((page) => {
          if (
            !page ||
            !/^\d{4}-\d{2}-\d{2}$/.test(page.serviceDate) ||
            !Array.isArray(page.items) ||
            page.items.length > 25 ||
            (page.nextOffset !== null &&
              (!Number.isInteger(page.nextOffset) || page.nextOffset <= (query.offset ?? 0)))
          ) {
            return invalidBookingResponse();
          }
          return { ...page, items: page.items.map(validateSupervisorLookup) };
        }),
      );
  }
  getHome(): Observable<SupervisorHome> {
    return this.http.get<SupervisorHome>(`${this.baseUrl}/home`).pipe(
      timeout(15000),
      map((value) => {
        const counters = value?.summary;
        if (
          !value ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value.serviceDate) ||
          !counters ||
          [
            value.pendingReassignmentsCount,
            counters.registeredAppointments,
            counters.inProcessAppointments,
            counters.completedAppointments,
            counters.deniedAppointments,
            counters.cancelledAppointments,
          ].some((count) => !Number.isInteger(count) || count < 0)
        )
          return invalidBookingResponse();
        return value;
      }),
    );
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.http
      .post<SupervisorEntryLookup>(`${this.baseUrl}/lookup`, request)
      .pipe(timeout(15000), map(validateSupervisorLookup));
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(`${environment.apiBaseUrl}/wash/executions/arrivals`, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(timeout(15000), map(validateAccepted));
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    if (
      command.decision === 'REJECTED' &&
      command.identityConfirmed == null &&
      command.requirementsSatisfied == null &&
      !environment.enableUnclassifiedEntryRejection
    )
      return throwError(
        () =>
          new ApplicationError(
            'temporary',
            'El rechazo con motivo libre no está habilitado.',
            503,
            'BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE',
          ),
      );
    const { idempotencyKey, washExecutionId, ...body } = command;
    return this.http
      .post<AcceptedOperation>(
        `${environment.apiBaseUrl}/wash/executions/${encodeURIComponent(washExecutionId)}/entry-decision`,
        body,
        {
          headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        },
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
