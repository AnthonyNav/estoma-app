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
}

export interface WashExecution {
  washExecutionId: string;
  status: WashExecutionStatus;
  version?: number;
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
