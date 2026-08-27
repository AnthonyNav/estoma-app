export type JornadaEstado = 'PUBLICADA' | 'CANCELADA' | 'FINALIZADA';

export interface Jornada {
  jornadaId: string;
  tipoJornadaId: string;
  tipoNombre: string;
  nombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  lugar: string;
  cupoTotal: number;
  fechaLimiteDocumentos: string;
  descripcion: string | null;
  estado: JornadaEstado;
  motivoCancelacion: string | null;
  version: number;
}

export interface TipoJornada {
  tipoJornadaId: string;
  nombre: string;
  semestresPermitidos: number[];
}
