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
  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup>;
  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation>;
  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation>;
  getOperation(operationId: string): Observable<DurableOperation>;
}

export const WASH_SUPERVISION_GATEWAY = new InjectionToken<WashSupervisionGateway>(
  'WASH_SUPERVISION_GATEWAY',
);
