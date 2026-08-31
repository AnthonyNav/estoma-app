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
  currentSemester: number;
}

export interface StudentWashAppointment {
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  appointmentType: AppointmentType;
  instrumentCount: number;
  pieceType: PieceType;
  courseSection: CourseSection;
  timeSlot: AppointmentTimeSlot;
  washExecution: WashExecution | null;
  qrUsageContext: QrUsageContext;
  qrRepresentation: string | null;
  appointmentVersion?: number;
  usesExceptionalAuthorization?: boolean;
  studentCancellationAction?: StudentCancellationAction;
}

export type StudentCancellationAction = 'AVAILABLE' | 'DEADLINE_PASSED' | 'NOT_APPLICABLE';

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
  executionVersion: number;
  arrivedAt?: string | null;
  rejectionReason?: string | null;
  exitSubmittedAt?: string | null;
  submittedExitMaterials?: ExitMaterials | null;
  completedAt?: string | null;
  finalExitMaterials?: ExitMaterials | null;
  activeResourceAssignment?: ActiveResourceAssignment | null;
  lastResourceAssignment?: ActiveResourceAssignment | null;
}

export interface ExitMaterials {
  packageCount: number;
  greenPaperCassette8Count: number;
  greenPaperCassette10Count: number;
  witnessTapePortionCount: number;
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
