import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, of } from 'rxjs';

import { Registro } from '../../domain/models/registro';
import {
  CrearRegistroCommand,
  RechazarRegistroCommand,
  RegistrosGateway,
} from '../../domain/ports/registros.gateway';

const MOCK_REGISTROS: Registro[] = [
  {
    registroId: 'registro-1',
    jornadaId: 'jornada-1',
    jornadaNombre: 'Jornada Intramuros Septiembre',
    alumnoId: 'alumno-1',
    alumnoNombre: 'Ana Torres Medina',
    estado: 'PENDIENTE_VALIDACION',
    motivoRechazo: null,
    version: 1,
  },
  {
    registroId: 'registro-2',
    jornadaId: 'jornada-1',
    jornadaNombre: 'Jornada Intramuros Septiembre',
    alumnoId: 'alumno-2',
    alumnoNombre: 'Luis Hernández Ríos',
    estado: 'CONFIRMADO',
    motivoRechazo: null,
    version: 2,
  },
];

// V1 mock simplification: does not touch MockJornadasAdapter's cupo — each
// feature's mock store is independent, same as the two real services only
// coordinate through events, never through a shared in-process object.
@Injectable()
export class MockRegistrosAdapter implements RegistrosGateway {
  private readonly registros$ = new BehaviorSubject<Registro[]>(
    MOCK_REGISTROS.map((r) => ({ ...r })),
  );

  listRegistros(): Observable<Registro[]> {
    return this.registros$.pipe(delay(200));
  }

  crearRegistro(command: CrearRegistroCommand): Observable<Registro> {
    const registro: Registro = {
      registroId: `registro-${crypto.randomUUID()}`,
      jornadaId: command.jornadaId,
      jornadaNombre: '',
      alumnoId: command.alumnoId,
      alumnoNombre: command.alumnoNombre,
      estado: 'PENDIENTE_VALIDACION',
      motivoRechazo: null,
      version: 1,
    };
    this.registros$.next([registro, ...this.registros$.value]);
    return of(registro).pipe(delay(300));
  }

  confirmarRegistro(registroId: string): Observable<Registro> {
    return this.transition(registroId, (registro) => ({
      ...registro,
      estado: 'CONFIRMADO',
      version: registro.version + 1,
    }));
  }

  rechazarRegistro(command: RechazarRegistroCommand): Observable<Registro> {
    return this.transition(command.registroId, (registro) => ({
      ...registro,
      estado: 'RECHAZADO',
      motivoRechazo: command.motivo,
      version: registro.version + 1,
    }));
  }

  cancelarRegistroPorAlumno(registroId: string): Observable<Registro> {
    return this.transition(registroId, (registro) => ({
      ...registro,
      estado: 'CANCELADO_ALUMNO',
      version: registro.version + 1,
    }));
  }

  private transition(
    registroId: string,
    apply: (registro: Registro) => Registro,
  ): Observable<Registro> {
    const current = this.registros$.value;
    const index = current.findIndex((r) => r.registroId === registroId);
    const updated = apply(current[index]);
    const next = [...current];
    next[index] = updated;
    this.registros$.next(next);
    return of(updated).pipe(delay(300));
  }
}
