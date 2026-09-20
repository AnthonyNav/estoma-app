import { SupervisorHome } from '../models/supervisor-home';
import { DirectoryQuery, SupervisorDirectory } from '../models/supervisor-entry';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../models/supervisor-entry';

export interface WashSupervisionGateway {
  getDirectory(query?: DirectoryQuery): Observable<SupervisorDirectory>;
  getHome(): Observable<SupervisorHome>;
  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup>;
  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation>;
  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_SUPERVISION_GATEWAY = new InjectionToken<WashSupervisionGateway>(
  'WASH_SUPERVISION_GATEWAY',
);
