import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Jornada, TipoJornada } from '../models/jornada';

export interface PublicarJornadaCommand {
  tipoJornadaId: string;
  nombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  lugar: string;
  cupoTotal: number;
  fechaLimiteDocumentos: string;
  descripcion?: string;
}

export interface CancelarJornadaCommand {
  jornadaId: string;
  motivo: string;
}

export interface JornadasGateway {
  listTiposJornada(): Observable<TipoJornada[]>;
  listJornadas(): Observable<Jornada[]>;
  publicarJornada(command: PublicarJornadaCommand): Observable<Jornada>;
  cancelarJornada(command: CancelarJornadaCommand): Observable<Jornada>;
}

export const JORNADAS_GATEWAY = new InjectionToken<JornadasGateway>('JORNADAS_GATEWAY');
