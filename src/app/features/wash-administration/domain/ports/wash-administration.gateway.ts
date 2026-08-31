import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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
} from '../models/wash-administration';

export interface WashAdministrationGateway {
  loadHome(): Observable<WashAdministrationHome>;
  loadCurrentWeek(): Observable<CurrentWeekOperation>;
  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview>;
  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation>;
  loadResources(): Observable<AdminResources>;
  registerCabin(command: RegisterCabinCommand): Observable<AcceptedOperation>;
  updateCabin(command: UpdateCabinCommand): Observable<AcceptedOperation>;
  registerTank(command: RegisterTankCommand): Observable<AcceptedOperation>;
  updateTank(command: UpdateTankCommand): Observable<AcceptedOperation>;
  changeResourceStatus(command: ChangeResourceStatusCommand): Observable<AcceptedOperation>;
  loadSupervisors(query: string): Observable<AdminSupervisor[]>;
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation>;
  suspendWashAccess(command: SuspendWashAccessCommand): Observable<AcceptedOperation>;
  restoreWashAccess(command: RestoreWashAccessCommand): Observable<AcceptedOperation>;
  regenerateSupervisorCredential(
    command: RegenerateSupervisorCredentialCommand,
  ): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_ADMINISTRATION_GATEWAY = new InjectionToken<WashAdministrationGateway>(
  'WASH_ADMINISTRATION_GATEWAY',
);
