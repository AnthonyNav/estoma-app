import { Injectable, inject } from '@angular/core';
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
  registerCabin(command: RegisterCabinCommand): Observable<AcceptedOperation> {
    return this.gateway.registerCabin(command);
  }
  updateCabin(command: UpdateCabinCommand): Observable<AcceptedOperation> {
    return this.gateway.updateCabin(command);
  }
  registerTank(command: RegisterTankCommand): Observable<AcceptedOperation> {
    return this.gateway.registerTank(command);
  }
  updateTank(command: UpdateTankCommand): Observable<AcceptedOperation> {
    return this.gateway.updateTank(command);
  }
  changeResourceStatus(command: ChangeResourceStatusCommand): Observable<AcceptedOperation> {
    return this.gateway.changeResourceStatus(command);
  }
  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    return this.gateway.loadSupervisors(query);
  }
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    return this.gateway.createSupervisorPerson(command);
  }
  suspendWashAccess(command: SuspendWashAccessCommand): Observable<AcceptedOperation> {
    return this.gateway.suspendWashAccess(command);
  }
  restoreWashAccess(command: RestoreWashAccessCommand): Observable<AcceptedOperation> {
    return this.gateway.restoreWashAccess(command);
  }
  regenerateSupervisorCredential(
    command: RegenerateSupervisorCredentialCommand,
  ): Observable<AcceptedOperation> {
    return this.gateway.regenerateSupervisorCredential(command);
  }
  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
