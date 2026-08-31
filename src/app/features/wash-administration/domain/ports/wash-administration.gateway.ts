import { InjectionToken } from '@angular/core';
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
} from '../models/wash-administration';

export interface WashAdministrationGateway {
  loadHome(): Observable<WashAdministrationHome>;
  loadCurrentWeek(): Observable<CurrentWeekOperation>;
  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview>;
  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation>;
  loadResources(): Observable<AdminResources>;
  changeResourceStatus(command: AdminResourceCommand): Observable<AcceptedOperation>;
  loadSupervisors(query: string): Observable<AdminSupervisor[]>;
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_ADMINISTRATION_GATEWAY = new InjectionToken<WashAdministrationGateway>(
  'WASH_ADMINISTRATION_GATEWAY',
);
