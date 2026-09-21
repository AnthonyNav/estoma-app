import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../../core/api/durable-operation';
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
  idempotencyKey: string;
}

export interface CancelarJornadaCommand {
  jornadaId: string;
  motivo: string;
  idempotencyKey: string;
}

export interface JornadasGateway {
  listTiposJornada(): Observable<TipoJornada[]>;
  listJornadas(): Observable<Jornada[]>;
  publicarJornada(command: PublicarJornadaCommand): Observable<AcceptedOperation>;
  cancelarJornada(command: CancelarJornadaCommand): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const JORNADAS_GATEWAY = new InjectionToken<JornadasGateway>('JORNADAS_GATEWAY');
