import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';

import {
  AcceptedOperation,
  DurableOperation,
  validateAccepted,
  validateOperation,
} from '../../../../core/api/durable-operation';
import { environment } from '../../../../../environments/environment';
import { Registro } from '../../domain/models/registro';
import {
  CrearRegistroCommand,
  RechazarRegistroCommand,
  RegistrosGateway,
} from '../../domain/ports/registros.gateway';

@Injectable()
export class HttpRegistrosAdapter implements RegistrosGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/registros`;

  misRegistros(): Observable<Registro[]> {
    return this.http.get<Registro[]>(`${this.baseUrl}/mios`).pipe(timeout(15000));
  }

  registrosDeJornada(jornadaId: string): Observable<Registro[]> {
    return this.http
      .get<Registro[]>(`${this.baseUrl}/jornada/${encodeURIComponent(jornadaId)}`)
      .pipe(timeout(15000));
  }

  crearRegistro(command: CrearRegistroCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(this.baseUrl, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(timeout(15000), map(validateAccepted));
  }

  confirmarRegistro(registroId: string, idempotencyKey: string): Observable<AcceptedOperation> {
    return this.http
      .post<AcceptedOperation>(
        `${this.baseUrl}/${encodeURIComponent(registroId)}/confirmar`,
        {},
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(timeout(15000), map(validateAccepted));
  }

  rechazarRegistro(command: RechazarRegistroCommand): Observable<AcceptedOperation> {
    const { registroId, idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(`${this.baseUrl}/${encodeURIComponent(registroId)}/rechazar`, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(timeout(15000), map(validateAccepted));
  }

  cancelarRegistroPorAlumno(
    registroId: string,
    idempotencyKey: string,
  ): Observable<AcceptedOperation> {
    return this.http
      .post<AcceptedOperation>(
        `${this.baseUrl}/${encodeURIComponent(registroId)}/cancelar`,
        {},
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(timeout(15000), map(validateAccepted));
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http
      .get<DurableOperation>(
        `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
      )
      .pipe(
        timeout(15000),
        map((value) => validateOperation(value, operationId)),
      );
  }
}
