import {
  invalidBookingResponse,
  uuidPattern,
} from '../../../wash-appointments/infrastructure/api/booking-validation';
import type {
  AuthorizationStudent,
  ExceptionalAuthorization,
} from '../../application/exceptional-authorizations.service';

export function validateStudents(value: AuthorizationStudent[]): AuthorizationStudent[] {
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    value.some(
      (student) =>
        !student ||
        typeof student.accountId !== 'string' ||
        !uuidPattern.test(student.accountId) ||
        typeof student.enrollment !== 'string' ||
        !student.enrollment.trim() ||
        typeof student.fullName !== 'string' ||
        !student.fullName.trim(),
    ) ||
    new Set(value.map((student) => student.accountId)).size !== value.length
  )
    return invalidBookingResponse();
  return value;
}

export function validateAuthorizations(
  value: ExceptionalAuthorization[],
): ExceptionalAuthorization[] {
  const statuses = ['AVAILABLE', 'CONSUMED', 'SUPERSEDED', 'CANCELLED', 'EXPIRED', 'UNKNOWN'];
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item.authorizationId !== 'string' ||
        !uuidPattern.test(item.authorizationId) ||
        !statuses.includes(item.status) ||
        (item.reason !== null && typeof item.reason !== 'string') ||
        typeof item.canCancel !== 'boolean' ||
        item.canCancel !== (item.status === 'AVAILABLE'),
    ) ||
    new Set(value.map((item) => item.authorizationId)).size !== value.length
  )
    return invalidBookingResponse();
  return value;
}
