import { SupervisorEntryLookup } from './supervisor-entry';
export interface PendingReassignment {
  washExecutionId: string;
  washExecutionStatus: string;
  executionVersion: number;
  authorizedAt: string | null;
  student: {
    displayName: string | null;
    enrollment: string | null;
    currentSemester: number | null;
  } | null;
  appointment:
    | (SupervisorEntryLookup['appointment'] & {
        appointmentTimeSlot: SupervisorEntryLookup['appointment']['appointmentTimeSlot'] & {
          serviceDate?: string;
        };
      })
    | null;
  activeResourceAssignment: SupervisorEntryLookup['activeResourceAssignment'];
}
export interface ReassignmentCandidate {
  cabinId: string;
  cabinCode: string;
  cabinName: string;
  tankId: string;
  tankCode: string;
  tankName: string;
  availableCapacity: number;
}
export interface ReassignmentCandidates {
  washExecutionId: string;
  executionVersion: number;
  snapshotGeneratedAt: string;
  recommendedCandidate: ReassignmentCandidate | null;
  candidates: ReassignmentCandidate[];
}
export interface ReassignmentCommand {
  washExecutionId: string;
  idempotencyKey: string;
  body:
    | { expectedVersion: number; cabinId: string; tankId: string }
    | {
        expectedVersion: number;
        cancellationSubreason: 'CAPACITY_LOSS';
        cancellationReason: string;
      };
}
export function canReassign(row: PendingReassignment): boolean {
  return (
    row.washExecutionStatus === 'PENDING_REASSIGNMENT' &&
    Number.isInteger(row.executionVersion) &&
    row.executionVersion > 0 &&
    !!row.washExecutionId &&
    !!row.student?.displayName &&
    !!row.student.enrollment &&
    !!row.appointment?.appointmentId &&
    ['SCHEDULED', 'IN_PROGRESS'].includes(row.appointment.appointmentStatus)
  );
}
export function candidateKey(candidate: ReassignmentCandidate): string {
  return `${candidate.cabinId}/${candidate.tankId}`;
}
