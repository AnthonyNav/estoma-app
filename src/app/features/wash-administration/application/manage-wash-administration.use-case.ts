import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
} from '../domain/models/wash-administration';
import { WASH_ADMINISTRATION_GATEWAY } from '../domain/ports/wash-administration.gateway';

@Injectable({ providedIn: 'root' })
export class ManageWashAdministrationUseCase {
  private readonly gateway = inject(WASH_ADMINISTRATION_GATEWAY);
  loadHome(): Observable<WashAdministrationHome> {
    return this.gateway.loadHome();
  }
  loadCurrentWeek(): Observable<CurrentWeekOperation> {
    return this.gateway.loadCurrentWeek();
  }
  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview> {
    return this.gateway.previewWeekDay(command);
  }
  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation> {
    return this.gateway.replaceWeekDay(command);
  }
  loadResources(): Observable<AdminResources> {
    return this.gateway.loadResources();
  }
  changeResourceStatus(command: AdminResourceCommand): Observable<AcceptedOperation> {
    return this.gateway.changeResourceStatus(command);
  }
  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    return this.gateway.loadSupervisors(query);
  }
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    return this.gateway.createSupervisorPerson(command);
  }
  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
