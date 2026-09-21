export type RegistroEstado =
  | 'PENDIENTE_VALIDACION'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'CANCELADO_ALUMNO'
  | 'CANCELADO_JORNADA_CANCELADA'
  | 'COMPLETADO';

export interface Registro {
  registroId: string;
  jornadaId: string;
  alumnoAccountId: string;
  estado: RegistroEstado;
  motivoRechazo: string | null;
}
