import { InjectionToken } from '@angular/core';
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
} from '../models/supervisor-entry';

export interface WashSupervisionGateway {
  loadHome(): Observable<SupervisorHome>;
  getManualAppointments(): Observable<SupervisorManualAppointments>;
  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup>;
  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation>;
  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation>;
  getPendingReassignments(): Observable<PendingReassignment[]>;
  getReassignmentCandidates(washExecutionId: string): Observable<ReassignmentCandidates>;
  reassign(command: ReassignWashCommand): Observable<AcceptedOperation>;
  cancelForCapacity(command: ClinicCancelCommand): Observable<AcceptedOperation>;
  complete(command: CompleteWashCommand): Observable<AcceptedOperation>;
  getOperationalResources(): Observable<OperationalResources>;
  disableResource(command: DisableOperationalResourceCommand): Observable<AcceptedOperation>;
  restoreResource(command: RestoreOperationalResourceCommand): Observable<AcceptedOperation>;
  getExceptionalAuthorizationContext(
    studentEnrollment: string,
  ): Observable<ExceptionalAuthorizationContext>;
  grantExceptionalAuthorization(
    command: GrantExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation>;
  cancelExceptionalAuthorization(
    command: CancelExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_SUPERVISION_GATEWAY = new InjectionToken<WashSupervisionGateway>(
  'WASH_SUPERVISION_GATEWAY',
);
