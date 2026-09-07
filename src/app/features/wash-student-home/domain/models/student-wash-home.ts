import { ExitMaterials } from '../../../wash-exit/domain/student-exit';
export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CANCELLED'
  | 'MISSED'
  | 'ENTRY_REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export type AppointmentType = 'NORMAL' | 'JOURNEY' | 'IMMUNOCOMPROMISED';

export type PieceType = 'HIGH_SPEED' | 'LOW_SPEED' | 'CONTRA_ANGLE';

export type WashExecutionStatus =
  | 'PENDING_ENTRY'
  | 'ENTRY_REJECTED'
  | 'PENDING_REASSIGNMENT'
  | 'IN_PROGRESS'
  | 'EXIT_SUBMITTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type QrUsageContext = 'ENTRY' | 'STUDENT_EXIT' | 'SUPERVISOR_EXIT_REVIEW' | 'NONE';

export interface StudentWashHome {
  student: StudentWashStudent;
  serviceDate: string;
  appointment: StudentWashAppointment | null;
}

export interface StudentWashStudent {
  firstName: string;
  fullName: string;
  studentEnrollment: string;
  currentSemester?: number | null;
}

export interface StudentWashAppointment {
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  appointmentVersion?: number;
  usesExceptionalAuthorization?: boolean;
  studentCancellationAction?: 'AVAILABLE' | 'DEADLINE_PASSED' | 'NOT_APPLICABLE';
  appointmentType: AppointmentType;
  instrumentCount?: number | null;
  pieceType?: PieceType | null;
  courseSection?: Partial<CourseSection> | null;
  timeSlot?: Partial<AppointmentTimeSlot> | null;
  washExecution: WashExecution | null;
  qrUsageContext: QrUsageContext;
  qrRepresentation: string | null;
}

export interface CourseSection {
  courseSectionId: string;
  nrc: string;
  name: string;
}

export interface AppointmentTimeSlot {
  appointmentTimeSlotId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  cancellationDeadlineAt?: string | null;
}

export interface WashExecution {
  washExecutionId: string;
  status: WashExecutionStatus;
  version?: number;
  executionVersion?: number;
  exitSubmittedAt?: string | null;
  submittedExitMaterials?: ExitMaterials | null;
  finalExitMaterials?: ExitMaterials | null;
  completedAt?: string | null;
  lastResourceAssignment?: ActiveResourceAssignment | null;
  arrivedAt?: string | null;
  rejectionReason?: string | null;
  activeResourceAssignment?: ActiveResourceAssignment | null;
}

export interface ActiveResourceAssignment {
  resourceAssignmentId: string;
  cabinId: string;
  cabinCode: string;
  cabinName: string;
  tankId: string;
  tankCode: string;
  tankName: string;
}
