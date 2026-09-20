import { SupervisorHome } from '../../domain/models/supervisor-home';
import { DirectoryQuery, SupervisorDirectory } from '../../domain/models/supervisor-entry';
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

  getDirectory(query: DirectoryQuery = {}): Observable<SupervisorDirectory> {
    return this.journey.supervisorDirectory().pipe(
      map((rows) => {
        const selected = rows.filter(
          (row) =>
            (!query.status ||
              query.status === 'ALL' ||
              row.appointment.appointmentStatus === query.status) &&
            `${row.student.displayName} ${row.student.studentEnrollment}`
              .toLocaleLowerCase('es-MX')
              .includes((query.query ?? '').toLocaleLowerCase('es-MX')),
        );
        const offset = query.offset ?? 0;
        return {
          serviceDate: rows[0]?.serviceDate ?? new Date().toISOString().slice(0, 10),
          items: selected.slice(offset, offset + 25),
          nextOffset: selected.length > offset + 25 ? offset + 25 : null,
        };
      }),
    );
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
