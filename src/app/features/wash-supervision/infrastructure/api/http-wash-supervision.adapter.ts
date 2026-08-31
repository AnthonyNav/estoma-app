import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  CancelExceptionalAuthorizationCommand,
  ClinicCancelCommand,
  CompleteWashCommand,
  DecideWashEntryCommand,
  DisableOperationalResourceCommand,
  DurableOperation,
  EntryLookupRequest,
  ExceptionalAuthorizationContext,
  GrantExceptionalAuthorizationCommand,
  OperationalResources,
  PendingReassignment,
  ReassignWashCommand,
  RegisterWashArrivalCommand,
  ReassignmentCandidates,
  RestoreOperationalResourceCommand,
  SupervisorEntryLookup,
  SupervisorHome,
} from '../../domain/models/supervisor-entry';
import { WashSupervisionGateway } from '../../domain/ports/wash-supervision.gateway';

@Injectable()
export class HttpWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/wash`;

  loadHome(): Observable<SupervisorHome> {
    return this.http.get<SupervisorHome>(`${this.baseUrl}/supervision/home`);
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.http.post<SupervisorEntryLookup>(`${this.baseUrl}/supervision/lookup`, request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.postOperation(`${this.baseUrl}/executions/arrivals`, body, idempotencyKey);
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/executions/${encodeURIComponent(washExecutionId)}/entry-decision`,
      body,
      idempotencyKey,
    );
  }

  getPendingReassignments(): Observable<PendingReassignment[]> {
    return this.http.get<PendingReassignment[]>(
      `${this.baseUrl}/supervision/pending-reassignments`,
    );
  }

  getReassignmentCandidates(washExecutionId: string): Observable<ReassignmentCandidates> {
    return this.http.get<ReassignmentCandidates>(
      `${this.baseUrl}/supervision/pending-reassignments/${encodeURIComponent(washExecutionId)}/candidates`,
    );
  }

  reassign(command: ReassignWashCommand): Observable<AcceptedOperation> {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/executions/${encodeURIComponent(washExecutionId)}/reassignment`,
      body,
      idempotencyKey,
    );
  }

  cancelForCapacity(command: ClinicCancelCommand): Observable<AcceptedOperation> {
    const { washExecutionId, idempotencyKey, cancellationReason, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/executions/${encodeURIComponent(washExecutionId)}/clinic-cancel`,
      { ...body, cancellationSubreason: 'CAPACITY_LOSS', cancellationReason },
      idempotencyKey,
    );
  }

  complete(command: CompleteWashCommand): Observable<AcceptedOperation> {
    const { washExecutionId, idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/executions/${encodeURIComponent(washExecutionId)}/complete`,
      body,
      idempotencyKey,
    );
  }

  getOperationalResources(): Observable<OperationalResources> {
    return this.http.get<OperationalResources>(`${this.baseUrl}/supervision/operational-resources`);
  }

  disableResource(command: DisableOperationalResourceCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/operational-resources/disable`,
      body,
      idempotencyKey,
    );
  }

  restoreResource(command: RestoreOperationalResourceCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/operational-resources/restore`,
      body,
      idempotencyKey,
    );
  }

  getExceptionalAuthorizationContext(
    studentEnrollment: string,
  ): Observable<ExceptionalAuthorizationContext> {
    return this.http.post<ExceptionalAuthorizationContext>(
      `${this.baseUrl}/supervision/exceptional-authorization-context`,
      { studentEnrollment },
    );
  }

  grantExceptionalAuthorization(
    command: GrantExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.postOperation(`${this.baseUrl}/exceptional-authorizations`, body, idempotencyKey);
  }

  cancelExceptionalAuthorization(
    command: CancelExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    const { authorizationId, idempotencyKey, ...body } = command;
    return this.postOperation(
      `${this.baseUrl}/exceptional-authorizations/${encodeURIComponent(authorizationId)}/cancel`,
      body,
      idempotencyKey,
    );
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(
      `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
    );
  }

  private postOperation(
    url: string,
    body: object,
    idempotencyKey: string,
  ): Observable<AcceptedOperation> {
    return this.http.post<AcceptedOperation>(url, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }
}
