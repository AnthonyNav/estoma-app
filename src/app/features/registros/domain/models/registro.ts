export type RegistroEstado =
  | 'PENDIENTE_VALIDACION'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'CANCELADO_ALUMNO'
  | 'CANCELADO_JORNADA_CANCELADA';

export interface Registro {
  registroId: string;
  jornadaId: string;
  jornadaNombre: string;
  alumnoId: string;
  alumnoNombre: string;
  estado: RegistroEstado;
  motivoRechazo: string | null;
  version: number;
}
