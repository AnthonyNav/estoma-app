import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  AdminResourceCommand,
  AdminResources,
  AdminSupervisor,
  CurrentWeekOperation,
  DurableOperation,
  ReplaceWeekDayCommand,
  SupervisorPersonCommand,
  WashAdministrationHome,
  WeekImpactPreview,
} from '../../domain/models/wash-administration';
import { WashAdministrationGateway } from '../../domain/ports/wash-administration.gateway';

@Injectable()
export class HttpWashAdministrationAdapter implements WashAdministrationGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/wash`;

  loadHome(): Observable<WashAdministrationHome> {
    return this.http.get<WashAdministrationHome>(`${this.baseUrl}/home`);
  }
  loadCurrentWeek(): Observable<CurrentWeekOperation> {
    return this.http.get<CurrentWeekOperation>(`${this.baseUrl}/operation/current-week`);
  }
  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview> {
    return this.http.post<WeekImpactPreview>(
      `${this.baseUrl}/operation/current-week/days/${command.dayOfWeek}/impact-preview`,
      { intervals: command.intervals },
    );
  }
  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation> {
    return this.http.put<AcceptedOperation>(
      `${this.baseUrl}/operation/current-week/days/${command.dayOfWeek}`,
      { intervals: command.intervals },
      { headers: this.idempotency(command.idempotencyKey) },
    );
  }
  loadResources(): Observable<AdminResources> {
    return this.http.get<AdminResources>(`${this.baseUrl}/resources`);
  }
  changeResourceStatus(command: AdminResourceCommand): Observable<AcceptedOperation> {
    const plural = command.resourceType === 'CABIN' ? 'cabins' : 'tanks';
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/${plural}/${encodeURIComponent(command.resourceId)}/${command.action}`,
      {},
      { headers: this.idempotency(command.idempotencyKey) },
    );
  }
  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    return this.http.get<AdminSupervisor[]>(`${this.baseUrl}/supervisors`, {
      params: query ? { q: query } : {},
    });
  }
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(`${this.baseUrl}/supervisors/person`, body, {
      headers: this.idempotency(idempotencyKey),
    });
  }
  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(
      `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
    );
  }
  private idempotency(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }
}
