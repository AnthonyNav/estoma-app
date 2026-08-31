import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
  SupervisorManualAppointments,
} from '../domain/models/supervisor-entry';
import { WASH_SUPERVISION_GATEWAY } from '../domain/ports/wash-supervision.gateway';

@Injectable({ providedIn: 'root' })
export class WashEntrySupervisionUseCase {
  private readonly gateway = inject(WASH_SUPERVISION_GATEWAY);

  loadHome(): Observable<SupervisorHome> {
    return this.gateway.loadHome();
  }

  getManualAppointments(): Observable<SupervisorManualAppointments> {
    return this.gateway.getManualAppointments();
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.gateway.lookup(request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    return this.gateway.registerArrival(command);
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    return this.gateway.decideEntry(command);
  }

  getPendingReassignments(): Observable<PendingReassignment[]> {
    return this.gateway.getPendingReassignments();
  }

  getReassignmentCandidates(washExecutionId: string): Observable<ReassignmentCandidates> {
    return this.gateway.getReassignmentCandidates(washExecutionId);
  }

  reassign(command: ReassignWashCommand): Observable<AcceptedOperation> {
    return this.gateway.reassign(command);
  }

  cancelForCapacity(command: ClinicCancelCommand): Observable<AcceptedOperation> {
    return this.gateway.cancelForCapacity(command);
  }

  complete(command: CompleteWashCommand): Observable<AcceptedOperation> {
    return this.gateway.complete(command);
  }

  getOperationalResources(): Observable<OperationalResources> {
    return this.gateway.getOperationalResources();
  }

  disableResource(command: DisableOperationalResourceCommand): Observable<AcceptedOperation> {
    return this.gateway.disableResource(command);
  }

  restoreResource(command: RestoreOperationalResourceCommand): Observable<AcceptedOperation> {
    return this.gateway.restoreResource(command);
  }

  getExceptionalAuthorizationContext(
    studentEnrollment: string,
  ): Observable<ExceptionalAuthorizationContext> {
    return this.gateway.getExceptionalAuthorizationContext(studentEnrollment);
  }

  grantExceptionalAuthorization(
    command: GrantExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    return this.gateway.grantExceptionalAuthorization(command);
  }

  cancelExceptionalAuthorization(
    command: CancelExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    return this.gateway.cancelExceptionalAuthorization(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
