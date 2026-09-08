import { SupervisorHome } from '../../domain/models/supervisor-home';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MockReassignmentAdapter } from './mock-reassignment.adapter';

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
  private readonly reassignments = inject(MockReassignmentAdapter);
  private readonly journey = inject(MockWashJourneyStore);

  getDirectory(): Observable<SupervisorEntryLookup[]> {
    return this.journey.supervisorDirectory();
  }
  getHome(): Observable<SupervisorHome> {
    return this.journey.supervisorHome().pipe(
      map((home) => ({
        ...home,
        pendingReassignmentsCount: home.pendingReassignmentsCount + this.reassignments.pendingCount,
      })),
    );
  }

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
