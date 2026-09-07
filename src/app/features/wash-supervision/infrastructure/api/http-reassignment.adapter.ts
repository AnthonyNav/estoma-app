import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, timeout } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ReassignmentGateway } from '../../domain/ports/reassignment.gateway';
import {
  PendingReassignment,
  ReassignmentCandidates,
  ReassignmentCommand,
} from '../../domain/models/reassignment';
import {
  AcceptedOperation,
  DurableOperation,
  SupervisorEntryLookup,
} from '../../domain/models/supervisor-entry';
import {
  invalidBookingResponse,
  validateAccepted,
  validateOperation,
} from '../../../wash-appointments/infrastructure/api/booking-validation';
import { validateSupervisorLookup } from './supervisor-lookup.validation';
@Injectable()
export class HttpReassignmentAdapter implements ReassignmentGateway {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  list() {
    return this.http
      .get<{ items: PendingReassignment[] }>(`${this.base}/wash/supervision/pending-reassignments`)
      .pipe(
        timeout(15000),
        map((value) => {
          if (
            !Array.isArray(value?.items) ||
            value.items.some((row) => !row || typeof row.washExecutionId !== 'string')
          )
            return invalidBookingResponse();
          return value.items;
        }),
      );
  }
  candidates(id: string) {
    return this.http
      .get<ReassignmentCandidates>(
        `${this.base}/wash/supervision/pending-reassignments/${encodeURIComponent(id)}/candidates`,
      )
      .pipe(
        timeout(15000),
        map((value) => {
          if (
            value?.washExecutionId !== id ||
            !Number.isInteger(value.executionVersion) ||
            value.executionVersion < 1 ||
            !Number.isFinite(Date.parse(value.snapshotGeneratedAt)) ||
            !Array.isArray(value.candidates) ||
            value.candidates.some(
              (c) =>
                !c ||
                !c.cabinId ||
                !c.tankId ||
                !c.cabinName ||
                !c.tankName ||
                !Number.isInteger(c.availableCapacity) ||
                c.availableCapacity <= 0,
            )
          )
            return invalidBookingResponse();
          return value;
        }),
      );
  }
  submit(command: ReassignmentCommand) {
    const action = 'cabinId' in command.body ? 'reassignment' : 'clinic-cancel';
    return this.http
      .post<AcceptedOperation>(
        `${this.base}/wash/executions/${encodeURIComponent(command.washExecutionId)}/${action}`,
        command.body,
        { headers: new HttpHeaders({ 'Idempotency-Key': command.idempotencyKey }) },
      )
      .pipe(timeout(15000), map(validateAccepted));
  }
  operation(id: string) {
    return this.http
      .get<DurableOperation>(`${this.base}/operations/${encodeURIComponent(id)}`)
      .pipe(
        timeout(15000),
        map((value) => validateOperation(value, id)),
      );
  }
  lookup(enrollment: string) {
    return this.http
      .post<SupervisorEntryLookup>(`${this.base}/wash/supervision/lookup`, {
        lookupType: 'STUDENT_ENROLLMENT',
        studentEnrollment: enrollment,
      })
      .pipe(timeout(15000), map(validateSupervisorLookup));
  }
}
