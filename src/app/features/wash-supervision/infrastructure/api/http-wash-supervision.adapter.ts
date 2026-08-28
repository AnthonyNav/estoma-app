import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../../domain/models/supervisor-entry';
import { WashSupervisionGateway } from '../../domain/ports/wash-supervision.gateway';

@Injectable()
export class HttpWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/wash/supervision`;

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.http.post<SupervisorEntryLookup>(`${this.baseUrl}/entry-lookup`, request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(`${this.baseUrl}/arrivals`, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(`${this.baseUrl}/entry-decisions`, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(`${environment.apiBaseUrl}/operations/${operationId}`);
  }
}
