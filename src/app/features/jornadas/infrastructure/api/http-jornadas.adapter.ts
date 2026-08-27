import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { Jornada, TipoJornada } from '../../domain/models/jornada';
import {
  CancelarJornadaCommand,
  JornadasGateway,
  PublicarJornadaCommand,
} from '../../domain/ports/jornadas.gateway';

/**
 * Provisional paths — platform-bff does not expose a Jornadas surface yet
 * (see estoma-services/platform-bff CommandRegistry / ProjectionEventRuntime;
 * wiring Jornadas commands+events into the BFF is scoped but not built).
 * Replace with the published BFF OpenAPI contract once it exists.
 */
@Injectable()
export class HttpJornadasAdapter implements JornadasGateway {
  private readonly http = inject(HttpClient);

  listTiposJornada(): Observable<TipoJornada[]> {
    return this.http.get<TipoJornada[]>(`${environment.apiBaseUrl}/jornadas/tipos`);
  }

  listJornadas(): Observable<Jornada[]> {
    return this.http.get<Jornada[]>(`${environment.apiBaseUrl}/jornadas`);
  }

  publicarJornada(command: PublicarJornadaCommand): Observable<Jornada> {
    return this.http.post<Jornada>(`${environment.apiBaseUrl}/jornadas`, command);
  }

  cancelarJornada(command: CancelarJornadaCommand): Observable<Jornada> {
    return this.http.post<Jornada>(
      `${environment.apiBaseUrl}/jornadas/${command.jornadaId}/cancelar`,
      command,
    );
  }
}
