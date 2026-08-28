import {
  StudentWashAppointment,
  StudentWashStudent,
  WashExecution,
} from '../../../wash-student-home/domain/models/student-wash-home';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';

export type EntryLookupRequest =
  | { lookupType: 'QR'; qrRepresentation: string }
  | { lookupType: 'STUDENT_ENROLLMENT'; studentEnrollment: string };

export interface SupervisorEntryLookup {
  serviceDate: string;
  student: Pick<StudentWashStudent, 'fullName' | 'studentEnrollment' | 'currentSemester'>;
  appointment: StudentWashAppointment;
  washExecution: WashExecution | null;
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

export type { AcceptedOperation, DurableOperation };
