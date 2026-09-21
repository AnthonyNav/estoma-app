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
import { Jornada, TipoJornada } from '../../domain/models/jornada';
import {
  CancelarJornadaCommand,
  JornadasGateway,
  PublicarJornadaCommand,
} from '../../domain/ports/jornadas.gateway';

@Injectable()
export class HttpJornadasAdapter implements JornadasGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/jornadas`;

  listTiposJornada(): Observable<TipoJornada[]> {
    return this.http.get<TipoJornada[]>(`${this.baseUrl}/tipos`).pipe(timeout(15000));
  }

  listJornadas(): Observable<Jornada[]> {
    return this.http.get<Jornada[]>(this.baseUrl).pipe(timeout(15000));
  }

  publicarJornada(command: PublicarJornadaCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(this.baseUrl, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(timeout(15000), map(validateAccepted));
  }

  cancelarJornada(command: CancelarJornadaCommand): Observable<AcceptedOperation> {
    const { jornadaId, idempotencyKey, ...body } = command;
    return this.http
      .post<AcceptedOperation>(`${this.baseUrl}/${encodeURIComponent(jornadaId)}/cancelar`, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
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
