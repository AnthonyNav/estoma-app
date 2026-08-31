import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';
import {
  ActiveResourceAssignment,
  AppointmentStatus,
  AppointmentType,
  CourseSection,
  ExitMaterials,
  PieceType,
  WashExecutionStatus,
} from '../../../wash-student-home/domain/models/student-wash-home';

export type SupervisorNextAction =
  | 'ENTRY'
  | 'ENTRY_DECISION'
  | 'REASSIGNMENT'
  | 'EXIT_REVIEW'
  | 'NONE';

export type EntryLookupRequest =
  | { lookupType: 'QR'; qrRepresentation: string }
  | { lookupType: 'STUDENT_ENROLLMENT'; studentEnrollment: string };

export interface SupervisorLookup {
  serviceDate: string;
  nextAction: SupervisorNextAction;
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
  washExecution: SupervisorWashExecution | null;
  activeResourceAssignment: OperationalResourceAssignment | null;
}

export interface SupervisorWashExecution {
  washExecutionId: string;
  status: WashExecutionStatus;
  executionVersion: number;
  arrivedAt: string | null;
  rejectionReason: string | null;
  exitSubmittedAt: string | null;
  submittedExitMaterials: ExitMaterials | null;
}

export interface OperationalResourceAssignment {
  resourceAssignmentId: string;
  assignmentType: 'INITIAL' | 'REASSIGNMENT';
  cabin: { resourceId: string; code: string; name: string };
  tank: { resourceId: string; code: string; name: string };
}

export interface SupervisorHome {
  serviceDate: string;
  summary: {
    registeredAppointments: number;
    inProcessAppointments: number;
    completedAppointments: number;
    deniedAppointments: number;
    cancelledAppointments: number;
  };
  pendingReassignmentsCount: number;
}

export interface RegisterWashArrivalCommand {
  appointmentId: string;
  idempotencyKey: string;
}

export interface DecideWashEntryCommand {
  washExecutionId: string;
  expectedVersion: number;
  decision: 'AUTHORIZED' | 'REJECTED';
  identityConfirmed: boolean;
  requirementsSatisfied: boolean;
  rejectionReason: string | null;
  idempotencyKey: string;
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

export interface PendingReassignment {
  washExecutionId: string;
  washExecutionStatus: 'PENDING_REASSIGNMENT';
  executionVersion: number;
  authorizedAt: string | null;
  appointment: SupervisorLookup['appointment'];
  student: SupervisorLookup['student'];
  activeResourceAssignment: OperationalResourceAssignment | null;
  submittedExitMaterials: ExitMaterials | null;
}

export interface ReassignmentCandidates {
  washExecutionId: string;
  executionVersion: number;
  snapshotGeneratedAt: string;
  recommendedCandidate: ReassignmentCandidate | null;
  candidates: ReassignmentCandidate[];
}

export interface ReassignWashCommand {
  washExecutionId: string;
  cabinId: string;
  tankId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ClinicCancelCommand {
  washExecutionId: string;
  expectedVersion: number;
  cancellationReason: string | null;
  idempotencyKey: string;
}

export interface CompleteWashCommand {
  washExecutionId: string;
  expectedVersion: number;
  finalMaterials: ExitMaterials;
  idempotencyKey: string;
}

export interface OperationalResources {
  snapshotGeneratedAt: string;
  cabins: OperationalCabin[];
}

export interface OperationalCabin {
  cabinId: string;
  code: string;
  name: string;
  cabinType: AppointmentType;
  administrativeStatus: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  directOperationalUnavailability: ResourceUnavailability | null;
  tanks: OperationalTank[];
}

export interface OperationalTank {
  tankId: string;
  code: string;
  name: string;
  configuredCapacity: number;
  administrativeStatus: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  directOperationalUnavailability: ResourceUnavailability | null;
  inheritedCabinOperationalUnavailability: ResourceUnavailability | null;
}

export interface ResourceUnavailability {
  resourceUnavailabilityId: string;
  causeType: 'FAILURE' | 'MANUAL_DISABLE';
  reason: string;
  disabledAt: string;
  detectedDuringWashExecutionId: string | null;
  unavailabilityVersion: number;
}

export interface DisableOperationalResourceCommand {
  cabinId: string | null;
  tankId: string | null;
  causeType: 'FAILURE' | 'MANUAL_DISABLE';
  reason: string;
  detectedDuringWashExecutionId: string | null;
  idempotencyKey: string;
}

export interface RestoreOperationalResourceCommand {
  resourceUnavailabilityId: string;
  resolution: string | null;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ExceptionalAuthorizationContext {
  serviceDate: string;
  student: SupervisorLookup['student'] & { academicStatus: 'ACTIVE' | 'INACTIVE' };
  dailyContext: {
    completedAppointments: number;
    dailyPenaltyPoints: number;
    activeAppointment: {
      appointmentId: string;
      appointmentStatus: AppointmentStatus;
      washExecutionStatus: WashExecutionStatus | null;
    } | null;
  };
  exceptionalAuthorization: {
    authorizationId: string;
    status: 'AVAILABLE' | 'CONSUMED' | 'CANCELLED' | 'EXPIRED';
    reason: string;
    grantedAt: string;
    consumedByAppointment: { appointmentId: string; appointmentStatus: AppointmentStatus } | null;
    cancellation: { reason: string; cancelledAt: string } | null;
    cancelAction?: 'AVAILABLE' | 'BLOCKED';
  } | null;
  grantAction: 'AVAILABLE' | 'BLOCKED';
  blockingReasons: string[];
}

export interface GrantExceptionalAuthorizationCommand {
  studentAccountId: string;
  reason: string;
  idempotencyKey: string;
}

export interface CancelExceptionalAuthorizationCommand {
  authorizationId: string;
  reason: string;
  idempotencyKey: string;
}

export type SupervisorEntryLookup = SupervisorLookup;
export type { AcceptedOperation, DurableOperation, ActiveResourceAssignment };
