import {
  AppointmentType,
  CourseSection,
  PieceType,
  StudentWashStudent,
} from '../../../wash-student-home/domain/models/student-wash-home';

export interface AppointmentFormContext {
  student: Pick<StudentWashStudent, 'fullName' | 'studentEnrollment' | 'currentSemester'>;
  availableCourseSections: CourseSection[];
}

export interface AppointmentDraft {
  appointmentType: AppointmentType;
  instrumentCount: number;
  pieceType: PieceType;
  courseSectionId: string;
  regulationAccepted: boolean;
}

export interface AvailabilityRequest {
  appointmentType: AppointmentType;
  instrumentCount: number;
  pieceType: PieceType;
  courseSectionId: string;
}

export interface AppointmentAvailability {
  canSchedule: boolean;
  blockingReasons: string[];
  dailyPenaltyPoints: number;
  dailyCompletedAppointments: number;
  exceptionalAuthorizationRequired: boolean;
  exceptionalAuthorizationAvailable: boolean;
  exceptionalAuthorizationId: string | null;
  availableTimeSlots: AvailableTimeSlot[];
}

export interface AvailableTimeSlot {
  appointmentTimeSlotId: string;
  startsAt: string;
  endsAt: string;
  availableCapacity: number;
  bookingDeadlineAt: string;
}

export interface ScheduleAppointmentCommand extends AppointmentDraft {
  appointmentTimeSlotId: string;
  exceptionalAuthorizationId: string | null;
  idempotencyKey: string;
}

export interface AcceptedOperation {
  operationId: string;
  status: 'PENDING';
  pollPath: string;
  submittedAt: string;
}

export type DurableOperationStatus = 'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'EXPIRED';

export interface DurableOperation {
  operationId: string;
  status: DurableOperationStatus;
  rejectionCode?: string;
}
