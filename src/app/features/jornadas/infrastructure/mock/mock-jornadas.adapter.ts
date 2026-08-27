import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, of, take } from 'rxjs';

import { Jornada, TipoJornada } from '../../domain/models/jornada';
import {
  CancelarJornadaCommand,
  JornadasGateway,
  PublicarJornadaCommand,
} from '../../domain/ports/jornadas.gateway';

const MOCK_TIPOS: TipoJornada[] = [
  { tipoJornadaId: 'tipo-intramuros', nombre: 'Intramuros', semestresPermitidos: [6, 7, 8, 9] },
  { tipoJornadaId: 'tipo-externa', nombre: 'Externa', semestresPermitidos: [7, 8, 9] },
  { tipoJornadaId: 'tipo-preventiva', nombre: 'Preventiva', semestresPermitidos: [6, 7] },
];

const MOCK_JORNADAS: Jornada[] = [
  {
    jornadaId: 'jornada-1',
    tipoJornadaId: 'tipo-intramuros',
    tipoNombre: 'Intramuros',
    nombre: 'Jornada Intramuros Septiembre',
    fecha: '2026-09-20',
    horaInicio: '09:00',
    horaFin: '13:00',
    lugar: 'Clínica Smile',
    cupoTotal: 20,
    fechaLimiteDocumentos: '2026-09-15',
    descripcion: 'Jornada de práctica clínica intramuros.',
    estado: 'PUBLICADA',
    motivoCancelacion: null,
    version: 1,
  },
  {
    jornadaId: 'jornada-2',
    tipoJornadaId: 'tipo-externa',
    tipoNombre: 'Externa',
    nombre: 'Jornada Externa Comunidad Rural',
    fecha: '2026-08-10',
    horaInicio: '08:00',
    horaFin: '14:00',
    lugar: 'Centro de Salud Tepeaca',
    cupoTotal: 15,
    fechaLimiteDocumentos: '2026-08-05',
    descripcion: 'Jornada de atención comunitaria.',
    estado: 'FINALIZADA',
    motivoCancelacion: null,
    version: 2,
  },
  {
    jornadaId: 'jornada-3',
    tipoJornadaId: 'tipo-preventiva',
    tipoNombre: 'Preventiva',
    nombre: 'Jornada Preventiva Escolar',
    fecha: '2026-09-05',
    horaInicio: '10:00',
    horaFin: '13:00',
    lugar: 'Primaria Benito Juárez',
    cupoTotal: 12,
    fechaLimiteDocumentos: '2026-08-30',
    descripcion: 'Cancelada por falta de instrumental disponible.',
    estado: 'CANCELADA',
    motivoCancelacion: 'Falta de instrumental disponible',
    version: 2,
  },
];

@Injectable()
export class MockJornadasAdapter implements JornadasGateway {
  private readonly jornadas$ = new BehaviorSubject<Jornada[]>(MOCK_JORNADAS.map((j) => ({ ...j })));

  listTiposJornada(): Observable<TipoJornada[]> {
    return of(MOCK_TIPOS).pipe(delay(200));
  }

  listJornadas(): Observable<Jornada[]> {
    return this.jornadas$.pipe(delay(200));
  }

  publicarJornada(command: PublicarJornadaCommand): Observable<Jornada> {
    const tipo = MOCK_TIPOS.find((t) => t.tipoJornadaId === command.tipoJornadaId);
    const jornada: Jornada = {
      jornadaId: `jornada-${crypto.randomUUID()}`,
      tipoJornadaId: command.tipoJornadaId,
      tipoNombre: tipo?.nombre ?? 'Desconocido',
      nombre: command.nombre,
      fecha: command.fecha,
      horaInicio: command.horaInicio,
      horaFin: command.horaFin,
      lugar: command.lugar,
      cupoTotal: command.cupoTotal,
      fechaLimiteDocumentos: command.fechaLimiteDocumentos,
      descripcion: command.descripcion ?? null,
      estado: 'PUBLICADA',
      motivoCancelacion: null,
      version: 1,
    };
    this.jornadas$.next([jornada, ...this.jornadas$.value]);
    return of(jornada).pipe(delay(300));
  }

  cancelarJornada(command: CancelarJornadaCommand): Observable<Jornada> {
    const current = this.jornadas$.value;
    const index = current.findIndex((j) => j.jornadaId === command.jornadaId);
    const target = current[index];
    const updated: Jornada = {
      ...target,
      estado: 'CANCELADA',
      motivoCancelacion: command.motivo,
      version: target.version + 1,
    };
    const next = [...current];
    next[index] = updated;
    this.jornadas$.next(next);
    return of(updated).pipe(delay(300), take(1));
  }
}
