import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../domain/models/supervisor-entry';
import { WASH_SUPERVISION_GATEWAY } from '../domain/ports/wash-supervision.gateway';

@Injectable({ providedIn: 'root' })
export class WashEntrySupervisionUseCase {
  private readonly gateway = inject(WASH_SUPERVISION_GATEWAY);

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.gateway.lookup(request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    return this.gateway.registerArrival(command);
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    return this.gateway.decideEntry(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
