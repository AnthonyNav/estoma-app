import { SupervisorExecutionDetail } from '../../../wash-exit/domain/supervisor-exit';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AcceptedOperation, DurableOperation } from '../models/supervisor-entry';
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
  detail(id: string): Observable<SupervisorExecutionDetail>;
}
export const REASSIGNMENT_GATEWAY = new InjectionToken<ReassignmentGateway>('REASSIGNMENT_GATEWAY');
