import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Registro } from '../models/registro';

export interface CrearRegistroCommand {
  jornadaId: string;
  alumnoId: string;
  alumnoNombre: string;
  semestreAlumno: number;
}

export interface RechazarRegistroCommand {
  registroId: string;
  motivo: string;
}

export interface RegistrosGateway {
  listRegistros(): Observable<Registro[]>;
  crearRegistro(command: CrearRegistroCommand): Observable<Registro>;
  confirmarRegistro(registroId: string): Observable<Registro>;
  rechazarRegistro(command: RechazarRegistroCommand): Observable<Registro>;
  cancelarRegistroPorAlumno(registroId: string): Observable<Registro>;
}

export const REGISTROS_GATEWAY = new InjectionToken<RegistrosGateway>('REGISTROS_GATEWAY');
