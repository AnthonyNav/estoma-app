import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AcceptedOperation,
  DurableOperation,
  SupervisorEntryLookup,
} from '../../wash-supervision/domain/models/supervisor-entry';
import { ExitMaterials, validMaterials } from './student-exit';
export interface CompleteExitCommand {
  washExecutionId: string;
  expectedVersion: number;
  finalMaterials: ExitMaterials;
  idempotencyKey: string;
}
export interface SupervisorExecutionDetail {
  student: SupervisorEntryLookup['student'];
  appointment: { appointmentId: string; appointmentStatus: string };
  washExecution: {
    washExecutionId: string;
    status: string;
    executionVersion: number;
    arrivedAt?: string;
    rejectionReason?: string | null;
    completedAt: string | null;
    submittedExitMaterials: ExitMaterials | null;
    finalExitMaterials: ExitMaterials | null;
    activeResourceAssignment: SupervisorEntryLookup['activeResourceAssignment'];
    lastResourceAssignment: SupervisorEntryLookup['activeResourceAssignment'];
  };
}
export interface SupervisorExitGateway {
  complete(command: CompleteExitCommand): Observable<AcceptedOperation>;
  operation(id: string): Observable<DurableOperation>;
  detail(id: string): Observable<SupervisorExecutionDetail>;
}
export const SUPERVISOR_EXIT_GATEWAY = new InjectionToken<SupervisorExitGateway>(
  'SUPERVISOR_EXIT_GATEWAY',
);
export function canCompleteExit(lookup: SupervisorEntryLookup | null): boolean {
  const execution = lookup?.washExecution;
  return (
    lookup?.nextAction === 'EXIT_REVIEW' &&
    execution?.status === 'EXIT_SUBMITTED' &&
    Number.isInteger(execution.executionVersion) &&
    execution.executionVersion > 0 &&
    !!execution.exitSubmittedAt &&
    Number.isFinite(Date.parse(execution.exitSubmittedAt)) &&
    validMaterials(execution.submittedExitMaterials) &&
    !!lookup.activeResourceAssignment?.cabin &&
    !!lookup.activeResourceAssignment.tank
  );
}
