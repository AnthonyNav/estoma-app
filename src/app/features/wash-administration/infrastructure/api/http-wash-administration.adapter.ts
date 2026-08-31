import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  AcceptedOperation,
  AdminResources,
  AdminSupervisor,
  ChangeResourceStatusCommand,
  CurrentWeekOperation,
  DurableOperation,
  RegisterCabinCommand,
  RegisterTankCommand,
  RegenerateSupervisorCredentialCommand,
  ReplaceWeekDayCommand,
  RestoreWashAccessCommand,
  SuspendWashAccessCommand,
  SupervisorPersonCommand,
  UpdateCabinCommand,
  UpdateTankCommand,
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
      this.weekDayProposal(command),
    );
  }
  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation> {
    return this.http.put<AcceptedOperation>(
      `${this.baseUrl}/operation/current-week/days/${command.dayOfWeek}`,
      this.weekDayProposal(command),
      { headers: this.idempotency(command.idempotencyKey) },
    );
  }
  loadResources(): Observable<AdminResources> {
    return this.http.get<AdminResources>(`${this.baseUrl}/resources`);
  }
  registerCabin(command: RegisterCabinCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(`${this.baseUrl}/cabins`, body, {
      headers: this.idempotency(idempotencyKey),
    });
  }
  updateCabin(command: UpdateCabinCommand): Observable<AcceptedOperation> {
    const { cabinId, idempotencyKey, ...body } = command;
    return this.http.patch<AcceptedOperation>(
      `${this.baseUrl}/cabins/${encodeURIComponent(cabinId)}`,
      body,
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  registerTank(command: RegisterTankCommand): Observable<AcceptedOperation> {
    const { cabinId, idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/cabins/${encodeURIComponent(cabinId)}/tanks`,
      body,
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  updateTank(command: UpdateTankCommand): Observable<AcceptedOperation> {
    const { tankId, idempotencyKey, ...body } = command;
    return this.http.patch<AcceptedOperation>(
      `${this.baseUrl}/tanks/${encodeURIComponent(tankId)}`,
      body,
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  changeResourceStatus(command: ChangeResourceStatusCommand): Observable<AcceptedOperation> {
    const plural = command.resourceType === 'CABIN' ? 'cabins' : 'tanks';
    const body =
      command.action === 'activate'
        ? { expectedVersion: command.expectedVersion }
        : { expectedVersion: command.expectedVersion, reason: command.reason };
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/${plural}/${encodeURIComponent(command.resourceId)}/${command.action}`,
      body,
      { headers: this.idempotency(command.idempotencyKey) },
    );
  }
  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    return this.http
      .get<{ supervisors: AdminSupervisor[] }>(`${this.baseUrl}/supervisors`, {
        params: query ? { q: query } : {},
      })
      .pipe(map(({ supervisors }) => supervisors));
  }
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    const { idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(`${this.baseUrl}/supervisors/person`, body, {
      headers: this.idempotency(idempotencyKey),
    });
  }
  suspendWashAccess(command: SuspendWashAccessCommand): Observable<AcceptedOperation> {
    const { accountId, idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/supervisors/${encodeURIComponent(accountId)}/wash-access/suspend`,
      body,
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  restoreWashAccess(command: RestoreWashAccessCommand): Observable<AcceptedOperation> {
    const { accountId, idempotencyKey, ...body } = command;
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/supervisors/${encodeURIComponent(accountId)}/wash-access/restore`,
      body,
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  regenerateSupervisorCredential(
    command: RegenerateSupervisorCredentialCommand,
  ): Observable<AcceptedOperation> {
    const { accountId, idempotencyKey } = command;
    return this.http.post<AcceptedOperation>(
      `${this.baseUrl}/supervisors/${encodeURIComponent(accountId)}/temporary-password-email/regenerate`,
      {},
      { headers: this.idempotency(idempotencyKey) },
    );
  }
  getOperation(operationId: string): Observable<DurableOperation> {
    return this.http.get<DurableOperation>(
      `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
    );
  }
  private idempotency(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }
  private weekDayProposal(
    command: ReplaceWeekDayCommand,
  ): Omit<ReplaceWeekDayCommand, 'idempotencyKey' | 'dayOfWeek'> {
    return {
      calendarId: command.calendarId,
      expectedSchedules: command.expectedSchedules,
      desiredIntervals: command.desiredIntervals,
    };
  }
}
