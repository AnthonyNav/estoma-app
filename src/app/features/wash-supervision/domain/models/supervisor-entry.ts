import {
  AppointmentStatus,
  AppointmentType,
  CourseSection,
  PieceType,
  WashExecutionStatus,
} from '../../../wash-student-home/domain/models/student-wash-home';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
export type EntryLookupRequest =
  | { lookupType: 'QR'; qrRepresentation: string }
  | { lookupType: 'STUDENT_ENROLLMENT'; studentEnrollment: string };
export interface SupervisorEntryLookup {
  canComplete?: boolean;
  serviceDate: string;
  nextAction: 'ENTRY' | 'ENTRY_DECISION' | 'REASSIGNMENT' | 'EXIT_REVIEW' | 'NONE';
  student: {
    studentAccountId: string;
    displayName: string;
    studentEnrollment: string;
    currentSemester: number;
  };
  appointment: {
    appointmentId: string;
    appointmentStatus: AppointmentStatus;
    appointmentType: AppointmentType;
    instrumentCount: number;
    pieceType: PieceType;
    courseSectionReference: CourseSection;
    appointmentTimeSlot: {
      appointmentTimeSlotId: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
    };
  };
  washExecution?: {
    washExecutionId: string;
    status: WashExecutionStatus;
    executionVersion: number;
    arrivedAt: string;
    rejectionReason?: string | null;
    exitSubmittedAt?: string | null;
    submittedExitMaterials?: {
      packageCount: number;
      greenPaperCassette8Count: number;
      greenPaperCassette10Count: number;
      witnessTapePortionCount: number;
    } | null;
  } | null;
  activeResourceAssignment?: {
    resourceAssignmentId: string;
    assignmentType: string;
    cabin: { resourceId: string; code: string; name: string };
    tank: { resourceId: string; code: string; name: string };
  } | null;
}
export interface RegisterWashArrivalCommand {
  appointmentId: string;
  idempotencyKey: string;
}
export interface DecideWashEntryCommand {
  washExecutionId: string;
  expectedVersion: number;
  decision: 'AUTHORIZED' | 'REJECTED';
  identityConfirmed?: boolean | null;
  requirementsSatisfied?: boolean | null;
  rejectionReason: string | null;
  idempotencyKey: string;
}
export type { AcceptedOperation, DurableOperation };
