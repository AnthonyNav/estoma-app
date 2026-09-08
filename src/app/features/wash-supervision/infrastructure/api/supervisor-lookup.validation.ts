import {
  invalidBookingResponse,
  uuidPattern,
} from '../../../wash-appointments/infrastructure/api/booking-validation';
import { SupervisorEntryLookup } from '../../domain/models/supervisor-entry';
export function validateSupervisorLookup(value: SupervisorEntryLookup): SupervisorEntryLookup {
  const student = value?.student;
  const appointment = value?.appointment;
  const slot = appointment?.appointmentTimeSlot;
  const course = appointment?.courseSectionReference;
  if (
    !value ||
    (value.canComplete !== undefined && typeof value.canComplete !== 'boolean') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.serviceDate) ||
    !['ENTRY', 'ENTRY_DECISION', 'REASSIGNMENT', 'EXIT_REVIEW', 'NONE'].includes(
      value.nextAction,
    ) ||
    !student ||
    !uuidPattern.test(student.studentAccountId) ||
    typeof student.displayName !== 'string' ||
    typeof student.studentEnrollment !== 'string' ||
    !Number.isInteger(student.currentSemester) ||
    student.currentSemester <= 0 ||
    !appointment ||
    !uuidPattern.test(appointment.appointmentId) ||
    !['SCHEDULED', 'CANCELLED', 'MISSED', 'ENTRY_REJECTED', 'IN_PROGRESS', 'COMPLETED'].includes(
      appointment.appointmentStatus,
    ) ||
    !['NORMAL', 'JOURNEY', 'IMMUNOCOMPROMISED'].includes(appointment.appointmentType) ||
    !['HIGH_SPEED', 'LOW_SPEED', 'CONTRA_ANGLE'].includes(appointment.pieceType) ||
    !Number.isInteger(appointment.instrumentCount) ||
    appointment.instrumentCount <= 0 ||
    !course ||
    !uuidPattern.test(course.courseSectionId) ||
    typeof course.nrc !== 'string' ||
    typeof course.name !== 'string' ||
    !slot ||
    !uuidPattern.test(slot.appointmentTimeSlotId) ||
    [slot.startsAt, slot.endsAt].some(
      (date) => typeof date !== 'string' || !Number.isFinite(Date.parse(date)),
    ) ||
    typeof slot.timezone !== 'string'
  )
    return invalidBookingResponse();
  const execution = value.washExecution;
  if (
    execution &&
    (!uuidPattern.test(execution.washExecutionId) ||
      !Number.isInteger(execution.executionVersion) ||
      execution.executionVersion <= 0 ||
      ![
        'PENDING_ENTRY',
        'ENTRY_REJECTED',
        'PENDING_REASSIGNMENT',
        'IN_PROGRESS',
        'EXIT_SUBMITTED',
        'COMPLETED',
        'CANCELLED',
      ].includes(execution.status) ||
      !Number.isFinite(Date.parse(execution.arrivedAt)) ||
      (execution.rejectionReason != null && typeof execution.rejectionReason !== 'string'))
  )
    return invalidBookingResponse();
  const assignment = value.activeResourceAssignment;
  if (
    assignment &&
    (!uuidPattern.test(assignment.resourceAssignmentId) ||
      typeof assignment.assignmentType !== 'string' ||
      [assignment.cabin, assignment.tank].some(
        (resource) =>
          !resource ||
          !uuidPattern.test(resource.resourceId) ||
          typeof resource.name !== 'string' ||
          typeof resource.code !== 'string',
      ))
  )
    return invalidBookingResponse();
  return value;
}
