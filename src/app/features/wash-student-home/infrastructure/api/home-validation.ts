import { StudentWashHome } from '../../domain/models/student-wash-home';
import {
  invalidBookingResponse,
  uuidPattern,
} from '../../../wash-appointments/infrastructure/api/booking-validation';
export function validateHome(home: StudentWashHome): StudentWashHome {
  if (
    !home ||
    !home.student ||
    ['firstName', 'fullName', 'studentEnrollment'].some(
      (key) => typeof (home.student as unknown as Record<string, unknown>)[key] !== 'string',
    ) ||
    typeof home.serviceDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(home.serviceDate)
  )
    return invalidBookingResponse();
  const appointment = home.appointment;
  if (appointment != null) {
    if (
      !uuidPattern.test(appointment.appointmentId) ||
      !['SCHEDULED', 'CANCELLED', 'MISSED', 'ENTRY_REJECTED', 'IN_PROGRESS', 'COMPLETED'].includes(
        appointment.appointmentStatus,
      ) ||
      !['NORMAL', 'JOURNEY', 'IMMUNOCOMPROMISED'].includes(appointment.appointmentType) ||
      !['NONE', 'ENTRY', 'STUDENT_EXIT', 'SUPERVISOR_EXIT_REVIEW'].includes(
        appointment.qrUsageContext,
      ) ||
      !Number.isInteger(appointment.appointmentVersion) ||
      typeof appointment.usesExceptionalAuthorization !== 'boolean' ||
      !['AVAILABLE', 'DEADLINE_PASSED', 'NOT_APPLICABLE'].includes(
        appointment.studentCancellationAction ?? '',
      )
    )
      return invalidBookingResponse();
    if (appointment.qrRepresentation != null && typeof appointment.qrRepresentation !== 'string')
      return invalidBookingResponse();
    if (
      appointment.washExecution &&
      ![
        'PENDING_ENTRY',
        'ENTRY_REJECTED',
        'PENDING_REASSIGNMENT',
        'IN_PROGRESS',
        'EXIT_SUBMITTED',
        'COMPLETED',
        'CANCELLED',
      ].includes(appointment.washExecution.status)
    )
      return invalidBookingResponse();
  }
  return { ...home, appointment: appointment ?? null };
}
