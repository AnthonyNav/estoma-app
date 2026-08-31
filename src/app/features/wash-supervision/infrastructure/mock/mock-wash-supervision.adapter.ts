import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import {
  AcceptedOperation,
  CancelExceptionalAuthorizationCommand,
  ClinicCancelCommand,
  CompleteWashCommand,
  DecideWashEntryCommand,
  DisableOperationalResourceCommand,
  DurableOperation,
  EntryLookupRequest,
  ExceptionalAuthorizationContext,
  GrantExceptionalAuthorizationCommand,
  OperationalResources,
  PendingReassignment,
  ReassignWashCommand,
  RegisterWashArrivalCommand,
  ReassignmentCandidates,
  RestoreOperationalResourceCommand,
  SupervisorEntryLookup,
  SupervisorHome,
} from '../../domain/models/supervisor-entry';
import { WashSupervisionGateway } from '../../domain/ports/wash-supervision.gateway';
import { MockWashJourneyStore } from '../../../wash-student-home/infrastructure/mock/mock-wash-journey.store';

interface PendingOperation {
  polls: number;
  resolve: () => void;
}

const appointment: PendingReassignment['appointment'] = {
  appointmentId: '11111111-1111-1111-1111-111111111111',
  appointmentStatus: 'IN_PROGRESS',
  appointmentType: 'NORMAL',
  instrumentCount: 15,
  pieceType: 'HIGH_SPEED',
  courseSectionReference: {
    courseSectionId: '22222222-2222-2222-2222-222222222222',
    nrc: '12345',
    name: 'Cirugía Bucal',
  },
  appointmentTimeSlot: {
    appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
    startsAt: '2026-08-29T10:00:00-06:00',
    endsAt: '2026-08-29T11:00:00-06:00',
    timezone: 'America/Mexico_City',
  },
};

const student: PendingReassignment['student'] = {
  studentAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  displayName: 'Ana García Reyes',
  studentEnrollment: '201945678',
  currentSemester: 7,
};

const candidate = {
  cabinId: '66666666-6666-6666-6666-666666666666',
  cabinCode: '107',
  cabinName: 'Cabina 107',
  tankId: '77777777-7777-7777-7777-777777777777',
  tankCode: 'B',
  tankName: 'Tina B',
  availableCapacity: 2,
};

@Injectable()
export class MockWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly journey = inject(MockWashJourneyStore);
  private readonly operations = new Map<string, PendingOperation>();
  private operationSequence = 0;
  private resources: OperationalResources = {
    snapshotGeneratedAt: '2026-08-29T18:00:00Z',
    cabins: [
      {
        cabinId: candidate.cabinId,
        code: candidate.cabinCode,
        name: candidate.cabinName,
        cabinType: 'NORMAL',
        administrativeStatus: 'ACTIVE',
        directOperationalUnavailability: null,
        tanks: [
          {
            tankId: candidate.tankId,
            code: candidate.tankCode,
            name: candidate.tankName,
            configuredCapacity: 2,
            administrativeStatus: 'ACTIVE',
            directOperationalUnavailability: null,
            inheritedCabinOperationalUnavailability: null,
          },
        ],
      },
    ],
  };
  private authorization: ExceptionalAuthorizationContext['exceptionalAuthorization'] = null;

  loadHome(): Observable<SupervisorHome> {
    return of<SupervisorHome>({
      serviceDate: '2026-08-29',
      summary: {
        registeredAppointments: 12,
        inProcessAppointments: 5,
        completedAppointments: 4,
        deniedAppointments: 1,
        cancelledAppointments: 0,
      },
      pendingReassignmentsCount: 1,
    }).pipe(delay(250));
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

  getPendingReassignments(): Observable<PendingReassignment[]> {
    return of([
      {
        washExecutionId: '44444444-4444-4444-4444-444444444444',
        washExecutionStatus: 'PENDING_REASSIGNMENT' as const,
        executionVersion: 2,
        authorizedAt: '2026-08-29T16:00:00Z',
        appointment,
        student,
        activeResourceAssignment: null,
        submittedExitMaterials: null,
      },
    ]).pipe(delay(250));
  }

  getReassignmentCandidates(washExecutionId: string): Observable<ReassignmentCandidates> {
    return of({
      washExecutionId,
      executionVersion: 2,
      snapshotGeneratedAt: '2026-08-29T18:00:00Z',
      recommendedCandidate: candidate,
      candidates: [candidate],
    }).pipe(delay(250));
  }

  reassign(command: ReassignWashCommand): Observable<AcceptedOperation> {
    void command;
    return this.acceptOperation();
  }

  cancelForCapacity(command: ClinicCancelCommand): Observable<AcceptedOperation> {
    void command;
    return this.acceptOperation();
  }

  complete(command: CompleteWashCommand): Observable<AcceptedOperation> {
    void command;
    return this.acceptOperation();
  }

  getOperationalResources(): Observable<OperationalResources> {
    return of(this.resources).pipe(delay(250));
  }

  disableResource(command: DisableOperationalResourceCommand): Observable<AcceptedOperation> {
    return this.acceptOperation(() => {
      this.resources = {
        ...this.resources,
        cabins: this.resources.cabins.map((cabin) => ({
          ...cabin,
          directOperationalUnavailability:
            command.cabinId === cabin.cabinId
              ? this.unavailability(cabin.cabinId, command)
              : cabin.directOperationalUnavailability,
          tanks: cabin.tanks.map((tank) => ({
            ...tank,
            directOperationalUnavailability:
              command.tankId === tank.tankId
                ? this.unavailability(tank.tankId, command)
                : tank.directOperationalUnavailability,
          })),
        })),
      };
    });
  }

  restoreResource(command: RestoreOperationalResourceCommand): Observable<AcceptedOperation> {
    return this.acceptOperation(() => {
      this.resources = {
        ...this.resources,
        cabins: this.resources.cabins.map((cabin) => ({
          ...cabin,
          directOperationalUnavailability:
            cabin.directOperationalUnavailability?.resourceUnavailabilityId ===
            command.resourceUnavailabilityId
              ? null
              : cabin.directOperationalUnavailability,
          tanks: cabin.tanks.map((tank) => ({
            ...tank,
            directOperationalUnavailability:
              tank.directOperationalUnavailability?.resourceUnavailabilityId ===
              command.resourceUnavailabilityId
                ? null
                : tank.directOperationalUnavailability,
          })),
        })),
      };
    });
  }

  getExceptionalAuthorizationContext(
    studentEnrollment: string,
  ): Observable<ExceptionalAuthorizationContext> {
    return of<ExceptionalAuthorizationContext>({
      serviceDate: '2026-08-29',
      student: { ...student, studentEnrollment, academicStatus: 'ACTIVE' as const },
      dailyContext: { completedAppointments: 1, dailyPenaltyPoints: 0, activeAppointment: null },
      exceptionalAuthorization: this.authorization,
      grantAction: this.authorization?.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE',
      blockingReasons:
        this.authorization?.status === 'AVAILABLE' ? ['AUTHORIZATION_ALREADY_AVAILABLE'] : [],
    }).pipe(delay(250));
  }

  grantExceptionalAuthorization(
    command: GrantExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    return this.acceptOperation(() => {
      this.authorization = {
        authorizationId: '88888888-8888-8888-8888-888888888888',
        status: 'AVAILABLE',
        reason: command.reason,
        grantedAt: '2026-08-29T20:30:00Z',
        consumedByAppointment: null,
        cancellation: null,
        cancelAction: 'AVAILABLE',
      };
    });
  }

  cancelExceptionalAuthorization(
    command: CancelExceptionalAuthorizationCommand,
  ): Observable<AcceptedOperation> {
    return this.acceptOperation(() => {
      if (this.authorization?.authorizationId === command.authorizationId) {
        this.authorization = {
          ...this.authorization,
          status: 'CANCELLED',
          cancellation: { reason: command.reason, cancelledAt: '2026-08-29T20:35:00Z' },
          cancelAction: 'BLOCKED',
        };
      }
    });
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return this.journey.getOperation(operationId);
    }

    operation.polls += 1;
    if (operation.polls < 2) {
      return of<DurableOperation>({ operationId, status: 'PENDING' }).pipe(delay(250));
    }
    operation.resolve();
    this.operations.delete(operationId);
    return of<DurableOperation>({ operationId, status: 'SUCCEEDED' }).pipe(delay(250));
  }

  private acceptOperation(resolve: () => void = () => undefined): Observable<AcceptedOperation> {
    this.operationSequence += 1;
    const operationId = `supervision-${this.operationSequence}`;
    this.operations.set(operationId, { polls: 0, resolve });
    return of<AcceptedOperation>({
      operationId,
      status: 'PENDING' as const,
      pollPath: `/api/v1/operations/${operationId}`,
      submittedAt: '2026-08-29T18:00:00Z',
    }).pipe(delay(200));
  }

  private unavailability(
    resourceId: string,
    command: DisableOperationalResourceCommand,
  ): OperationalResources['cabins'][number]['directOperationalUnavailability'] {
    return {
      resourceUnavailabilityId: `unavailability-${resourceId}`,
      causeType: command.causeType,
      reason: command.reason,
      disabledAt: '2026-08-29T18:00:00Z',
      detectedDuringWashExecutionId: command.detectedDuringWashExecutionId,
      unavailabilityVersion: 1,
    };
  }
}
