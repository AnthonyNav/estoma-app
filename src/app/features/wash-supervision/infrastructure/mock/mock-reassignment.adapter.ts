import { Injectable } from '@angular/core';
import { defer, delay, of, throwError } from 'rxjs';
import { ApplicationError } from '../../../../core/api/application-error';
import { ReassignmentGateway } from '../../domain/ports/reassignment.gateway';
import {
  PendingReassignment,
  ReassignmentCommand,
  ReassignmentCandidates,
} from '../../domain/models/reassignment';
import {
  AcceptedOperation,
  DurableOperation,
  SupervisorEntryLookup,
} from '../../domain/models/supervisor-entry';
import { candidateExamples, pendingExample } from './reassignment.fixtures';
interface DemoState {
  rows: PendingReassignment[];
  commands: Record<string, { command: ReassignmentCommand; receipt: AcceptedOperation }>;
}
@Injectable({ providedIn: 'root' })
export class MockReassignmentAdapter implements ReassignmentGateway {
  private readonly storageKey = 'estoma.reassignment.demo.v1';
  private state = this.restore();
  private restore(): DemoState {
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      /* Use a fresh demo when storage is unavailable. */
    }
    const ana: PendingReassignment = structuredClone(pendingExample);
    const start = new Date();
    start.setMinutes(0, 0, 0);
    ana.appointment!.appointmentTimeSlot.startsAt = start.toISOString();
    ana.appointment!.appointmentTimeSlot.endsAt = new Date(+start + 3600000).toISOString();
    const carlos = structuredClone(ana);
    carlos.washExecutionId = '44444444-4444-4444-4444-444444444445';
    carlos.appointment!.appointmentId = '11111111-1111-1111-1111-111111111112';
    carlos.student = {
      displayName: 'Carlos Mendoza López',
      enrollment: '201945679',
      currentSemester: 6,
    };
    carlos.activeResourceAssignment = null;
    return { rows: [ana, carlos], commands: {} };
  }
  private persist() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      /* In-memory demo remains usable. */
    }
  }
  get pendingCount() {
    return this.state.rows.filter((r) => r.washExecutionStatus === 'PENDING_REASSIGNMENT').length;
  }
  list() {
    return of(
      structuredClone(
        this.state.rows.filter((r) => r.washExecutionStatus === 'PENDING_REASSIGNMENT'),
      ),
    ).pipe(delay(300));
  }
  candidates(id: string) {
    const scenario = new URLSearchParams(location.search).get('reassignmentDemo');
    if (scenario === 'unavailable')
      return throwError(
        () =>
          new ApplicationError(
            'temporary',
            'Consulta no disponible',
            503,
            'BFF.PROJECTION_UNAVAILABLE',
          ),
      );
    const row = this.state.rows.find((r) => r.washExecutionId === id)!;
    if (!row || row.washExecutionStatus !== 'PENDING_REASSIGNMENT')
      return throwError(() => new ApplicationError('temporary', 'Consulta no disponible', 503));
    const choices =
      scenario === 'empty' || row.student?.enrollment === '201945679'
        ? []
        : structuredClone(candidateExamples);
    return of<ReassignmentCandidates>({
      washExecutionId: id,
      executionVersion: row.executionVersion,
      snapshotGeneratedAt: new Date().toISOString(),
      candidates: choices,
      recommendedCandidate: choices[0] ?? null,
    }).pipe(delay(350));
  }
  submit(command: ReassignmentCommand) {
    return defer(() => {
      const saved = this.state.commands[command.idempotencyKey];
      if (saved) return of(saved.receipt);
      const id = crypto.randomUUID();
      const receipt: AcceptedOperation = {
        operationId: id,
        status: 'PENDING',
        pollPath: `/api/v1/operations/${id}`,
        submittedAt: new Date().toISOString(),
      };
      this.state.commands[command.idempotencyKey] = { command: structuredClone(command), receipt };
      this.persist();
      return of(receipt);
    }).pipe(delay(450));
  }
  operation(id: string) {
    return defer(() => {
      const saved = Object.values(this.state.commands).find((c) => c.receipt.operationId === id);
      if (!saved) return throwError(() => new Error('Unknown demo operation'));
      const { command, receipt } = saved;
      if (Date.now() - Date.parse(receipt.submittedAt) < 1300)
        return of<DurableOperation>({ operationId: id, status: 'PENDING' });
      const row = this.state.rows.find((r) => r.washExecutionId === command.washExecutionId)!;
      if (row.executionVersion === command.body.expectedVersion) {
        if ('cabinId' in command.body) {
          const body = command.body;
          const choice = candidateExamples.find(
            (c) => c.cabinId === body.cabinId && c.tankId === body.tankId,
          )!;
          row.washExecutionStatus = 'IN_PROGRESS';
          row.appointment!.appointmentStatus = 'IN_PROGRESS';
          row.activeResourceAssignment = {
            resourceAssignmentId: crypto.randomUUID(),
            assignmentType: row.activeResourceAssignment ? 'REASSIGNMENT' : 'INITIAL',
            cabin: { resourceId: choice.cabinId, code: choice.cabinCode, name: choice.cabinName },
            tank: { resourceId: choice.tankId, code: choice.tankCode, name: choice.tankName },
          };
        } else {
          row.washExecutionStatus = 'CANCELLED';
          row.appointment!.appointmentStatus = 'CANCELLED';
        }
        row.executionVersion++;
        this.persist();
      }
      return of<DurableOperation>({
        operationId: id,
        status: 'SUCCEEDED',
        data: {
          status: row.washExecutionStatus,
          tankId: row.activeResourceAssignment?.tank.resourceId,
        },
      });
    });
  }
  lookup(enrollment: string) {
    const row = this.state.rows.find((r) => r.student?.enrollment === enrollment)!;
    return of({
      serviceDate: new Date().toISOString().slice(0, 10),
      nextAction: 'NONE',
      student: {
        studentAccountId: '55555555-5555-5555-5555-555555555555',
        displayName: row.student!.displayName!,
        studentEnrollment: enrollment,
        currentSemester: row.student!.currentSemester!,
      },
      appointment: row.appointment!,
      washExecution: {
        washExecutionId: row.washExecutionId,
        status: row.washExecutionStatus,
        executionVersion: row.executionVersion,
        arrivedAt: row.authorizedAt!,
      },
      activeResourceAssignment: row.activeResourceAssignment,
    } as SupervisorEntryLookup).pipe(delay(300));
  }
}
