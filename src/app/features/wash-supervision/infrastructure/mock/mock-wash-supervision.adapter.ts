import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcceptedOperation,
  DecideWashEntryCommand,
  DurableOperation,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorEntryLookup,
} from '../../domain/models/supervisor-entry';
import { WashSupervisionGateway } from '../../domain/ports/wash-supervision.gateway';
import { MockWashJourneyStore } from '../../../wash-student-home/infrastructure/mock/mock-wash-journey.store';

@Injectable()
export class MockWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly journey = inject(MockWashJourneyStore);

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    return this.journey.lookup(request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    return this.journey.registerArrival(command);
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    return this.journey.decideEntry(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.journey.getOperation(operationId);
  }
}
