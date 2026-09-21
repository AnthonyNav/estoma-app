import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../../core/api/durable-operation';
import { Registro } from '../models/registro';

export interface CrearRegistroCommand {
  jornadaId: string;
  idempotencyKey: string;
}

export interface RechazarRegistroCommand {
  registroId: string;
  motivo: string;
  idempotencyKey: string;
}

export interface RegistrosGateway {
  misRegistros(): Observable<Registro[]>;
  registrosDeJornada(jornadaId: string): Observable<Registro[]>;
  crearRegistro(command: CrearRegistroCommand): Observable<AcceptedOperation>;
  confirmarRegistro(registroId: string, idempotencyKey: string): Observable<AcceptedOperation>;
  rechazarRegistro(command: RechazarRegistroCommand): Observable<AcceptedOperation>;
  cancelarRegistroPorAlumno(
    registroId: string,
    idempotencyKey: string,
  ): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const REGISTROS_GATEWAY = new InjectionToken<RegistrosGateway>('REGISTROS_GATEWAY');
