import { ApplicationError } from '../../../../core/api/application-error';
import {
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  DurableOperation,
} from '../../domain/models/appointment-registration';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invalidBookingResponse(): never {
  throw new ApplicationError(
    'temporary',
    'No pudimos validar la información recibida. Intenta nuevamente.',
  );
}
export function validateContext(value: AppointmentFormContext): AppointmentFormContext {
  if (
    !value?.student ||
    typeof value.student.fullName !== 'string' ||
    typeof value.student.studentEnrollment !== 'string'
  )
    return invalidBookingResponse();
  if (value.availableCourseSections != null && !Array.isArray(value.availableCourseSections))
    return invalidBookingResponse();
  return {
    ...value,
    availableCourseSections: (value.availableCourseSections ?? [])
      .filter((section) => section && uuidPattern.test(section.courseSectionId))
      .map((section) => ({
        ...section,
        nrc: section.nrc ?? 'NRC no disponible',
        name: section.name ?? 'Materia sin nombre',
      })),
  };
}
export function validateAvailability(value: AppointmentAvailability): AppointmentAvailability {
  if (
    !value ||
    typeof value.canSchedule !== 'boolean' ||
    !Array.isArray(value.blockingReasons) ||
    value.blockingReasons.some((code) => typeof code !== 'string') ||
    !Array.isArray(value.availableTimeSlots) ||
    typeof value.exceptionalAuthorizationRequired !== 'boolean' ||
    typeof value.exceptionalAuthorizationAvailable !== 'boolean'
  )
    return invalidBookingResponse();
  if (
    value.exceptionalAuthorizationId != null &&
    !uuidPattern.test(value.exceptionalAuthorizationId)
  )
    return invalidBookingResponse();
  for (const slot of value.availableTimeSlots) {
    if (
      !slot ||
      !uuidPattern.test(slot.appointmentTimeSlotId) ||
      !Number.isInteger(slot.availableCapacity) ||
      slot.availableCapacity <= 0 ||
      [slot.startsAt, slot.endsAt, slot.bookingDeadlineAt].some(
        (date) => typeof date !== 'string' || !Number.isFinite(Date.parse(date)),
      )
    )
      return invalidBookingResponse();
  }
  return value;
}
export function validateAccepted(value: AcceptedOperation): AcceptedOperation {
  if (
    !value ||
    !uuidPattern.test(value.operationId) ||
    !['PENDING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'EXPIRED'].includes(value.status) ||
    value.pollPath !== `/api/v1/operations/${value.operationId}` ||
    !Number.isFinite(Date.parse(value.submittedAt))
  )
    return invalidBookingResponse();
  return value;
}
export function validateOperation(value: DurableOperation, operationId: string): DurableOperation {
  if (
    !value ||
    value.operationId !== operationId ||
    !['PENDING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'EXPIRED'].includes(value.status)
  )
    return invalidBookingResponse();
  if (value.errorCode != null && typeof value.errorCode !== 'string')
    return invalidBookingResponse();
  return value;
}
