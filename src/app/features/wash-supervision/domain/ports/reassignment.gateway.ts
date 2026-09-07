import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AcceptedOperation,
  DurableOperation,
  SupervisorEntryLookup,
} from '../models/supervisor-entry';
import {
  PendingReassignment,
  ReassignmentCandidates,
  ReassignmentCommand,
} from '../models/reassignment';
export interface ReassignmentGateway {
  list(): Observable<PendingReassignment[]>;
  candidates(id: string): Observable<ReassignmentCandidates>;
  submit(command: ReassignmentCommand): Observable<AcceptedOperation>;
  operation(id: string): Observable<DurableOperation>;
  lookup(enrollment: string): Observable<SupervisorEntryLookup>;
}
export const REASSIGNMENT_GATEWAY = new InjectionToken<ReassignmentGateway>('REASSIGNMENT_GATEWAY');
