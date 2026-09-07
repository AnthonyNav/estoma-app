const messages: Record<string, string> = {
  ACTIVE_APPOINTMENT_EXISTS: 'Ya tienes una cita activa. Consulta tu inicio.',
  APPOINTMENT_ALREADY_EXISTS: 'Tu cita ya está registrada. Consulta tu inicio.',
  STUDENT_BLOCKED: 'Alcanzaste el límite de penalizaciones de hoy.',
  DAILY_COMPLETED_LIMIT: 'Alcanzaste el límite de citas completadas de hoy.',
  EXCEPTIONAL_AUTHORIZATION_REQUIRED:
    'Necesitas una autorización excepcional. Solicita apoyo al área de Lavado.',
  ACADEMIC_ENROLLMENT_INVALID: 'Tu inscripción académica no permite registrar esta cita.',
  STUDENT_ACCESS_DENIED: 'No tienes acceso para registrar esta cita.',
  FORBIDDEN: 'No tienes acceso para registrar esta cita.',
  CAPACITY_EXHAUSTED: 'El cupo cambió. Consulta los horarios disponibles nuevamente.',
  IMMUNOCOMPROMISED_RESERVATION_CONFLICT:
    'El horario ya no está disponible para este tipo de cita.',
  SLOT_NOT_BOOKABLE: 'El plazo para reservar este horario terminó.',
  SLOT_NOT_FOUND: 'El horario ya no está disponible.',
  SERVICE_DATE_NOT_CURRENT: 'El día de servicio cambió. Consulta los horarios nuevamente.',
  REGULATION_NOT_ACCEPTED: 'Debes aceptar el reglamento antes de reservar.',
  ACADEMIC_PROJECTION_UNRELIABLE:
    'La información académica se está actualizando. Intenta más tarde.',
  CAPACITY_UNAVAILABLE: 'No se puede verificar la capacidad en este momento.',
};
export function bookingMessage(code?: string | null): string {
  if (code?.startsWith('EXCEPTIONAL_AUTHORIZATION_'))
    return (
      messages[code] ??
      'La autorización excepcional no está disponible para esta reserva. Solicita apoyo al área de Lavado.'
    );
  return (
    (code && messages[code]) ||
    'No fue posible confirmar la cita. Consulta al área de Lavado con la referencia de tu solicitud.'
  );
}
