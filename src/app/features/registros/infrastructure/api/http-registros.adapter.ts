import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { Registro } from '../../domain/models/registro';
import {
  CrearRegistroCommand,
  RechazarRegistroCommand,
  RegistrosGateway,
} from '../../domain/ports/registros.gateway';

/** Provisional paths — platform-bff exposes no Registros surface yet (same gap as Jornadas). */
@Injectable()
export class HttpRegistrosAdapter implements RegistrosGateway {
  private readonly http = inject(HttpClient);

  listRegistros(): Observable<Registro[]> {
    return this.http.get<Registro[]>(`${environment.apiBaseUrl}/registros`);
  }

  crearRegistro(command: CrearRegistroCommand): Observable<Registro> {
    return this.http.post<Registro>(`${environment.apiBaseUrl}/registros`, command);
  }

  confirmarRegistro(registroId: string): Observable<Registro> {
    return this.http.post<Registro>(
      `${environment.apiBaseUrl}/registros/${registroId}/confirmar`,
      {},
    );
  }

  rechazarRegistro(command: RechazarRegistroCommand): Observable<Registro> {
    return this.http.post<Registro>(
      `${environment.apiBaseUrl}/registros/${command.registroId}/rechazar`,
      command,
    );
  }

  cancelarRegistroPorAlumno(registroId: string): Observable<Registro> {
    return this.http.post<Registro>(
      `${environment.apiBaseUrl}/registros/${registroId}/cancelar`,
      {},
    );
  }
}
