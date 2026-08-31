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
  SupervisorManualAppointment,
  SupervisorManualAppointments,
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

const manualAssignment: SupervisorEntryLookup['activeResourceAssignment'] = {
  resourceAssignmentId: 'd1e3f5a7-b9c1-4d2e-8f01-234567890123',
  assignmentType: 'INITIAL',
  cabin: {
    resourceId: candidate.cabinId,
    code: candidate.cabinCode,
    name: candidate.cabinName,
  },
  tank: {
    resourceId: candidate.tankId,
    code: candidate.tankCode,
    name: candidate.tankName,
  },
};

@Injectable()
export class MockWashSupervisionAdapter implements WashSupervisionGateway {
  private readonly journey = inject(MockWashJourneyStore);
  private readonly operations = new Map<string, PendingOperation>();
  private operationSequence = 0;
  private pendingReassignments: PendingReassignment[] = [
    {
      washExecutionId: '44444444-4444-4444-4444-444444444444',
      washExecutionStatus: 'PENDING_REASSIGNMENT',
      executionVersion: 2,
      authorizedAt: '2026-08-29T16:00:00Z',
      appointment,
      student,
      activeResourceAssignment: null,
      submittedExitMaterials: null,
    },
  ];
  private manualAppointments: SupervisorManualAppointment[] = [
    {
      manualSelectionStatus: 'REGISTERED',
      nextAction: 'ENTRY',
      student: {
        studentAccountId: 'b1111111-1111-1111-1111-111111111111',
        displayName: 'Brenda Martínez Soto',
        studentEnrollment: '202145301',
        currentSemester: 6,
      },
      appointment: {
        appointmentId: 'b2222222-2222-2222-2222-222222222222',
        appointmentStatus: 'SCHEDULED',
        appointmentType: 'NORMAL',
        instrumentCount: 12,
        pieceType: 'LOW_SPEED',
        courseSectionReference: {
          courseSectionId: 'b3333333-3333-3333-3333-333333333333',
          nrc: '38421',
          name: 'Endodoncia',
        },
        appointmentTimeSlot: {
          appointmentTimeSlotId: 'b4444444-4444-4444-4444-444444444444',
          startsAt: '2026-08-29T09:00:00-06:00',
          endsAt: '2026-08-29T10:00:00-06:00',
          timezone: 'America/Mexico_City',
        },
      },
      washExecution: null,
      activeResourceAssignment: null,
    },
    {
      manualSelectionStatus: 'IN_PROGRESS',
      nextAction: 'EXIT_REVIEW',
      student: {
        studentAccountId: 'c1111111-1111-1111-1111-111111111111',
        displayName: 'Diego Ramírez Luna',
        studentEnrollment: '202045812',
        currentSemester: 8,
      },
      appointment: {
        appointmentId: 'c2222222-2222-2222-2222-222222222222',
        appointmentStatus: 'IN_PROGRESS',
        appointmentType: 'NORMAL',
        instrumentCount: 18,
        pieceType: 'HIGH_SPEED',
        courseSectionReference: {
          courseSectionId: 'c3333333-3333-3333-3333-333333333333',
          nrc: '16290',
          name: 'Cirugía Bucal',
        },
        appointmentTimeSlot: {
          appointmentTimeSlotId: 'c4444444-4444-4444-4444-444444444444',
          startsAt: '2026-08-29T10:00:00-06:00',
          endsAt: '2026-08-29T11:00:00-06:00',
          timezone: 'America/Mexico_City',
        },
      },
      washExecution: {
        washExecutionId: 'c5555555-5555-5555-5555-555555555555',
        status: 'IN_PROGRESS',
        executionVersion: 3,
        arrivedAt: '2026-08-29T15:03:00Z',
        rejectionReason: null,
        exitSubmittedAt: null,
        submittedExitMaterials: null,
      },
      activeResourceAssignment: manualAssignment,
    },
    {
      manualSelectionStatus: 'IN_PROGRESS',
      nextAction: 'EXIT_REVIEW',
      student: {
        studentAccountId: 'd1111111-1111-1111-1111-111111111111',
        displayName: 'Mariana Ortega Cruz',
        studentEnrollment: '202244713',
        currentSemester: 4,
      },
      appointment: {
        appointmentId: 'd2222222-2222-2222-2222-222222222222',
        appointmentStatus: 'IN_PROGRESS',
        appointmentType: 'JOURNEY',
        instrumentCount: 9,
        pieceType: 'HIGH_SPEED',
        courseSectionReference: {
          courseSectionId: 'd3333333-3333-3333-3333-333333333333',
          nrc: '47218',
          name: 'Odontopediatría',
        },
        appointmentTimeSlot: {
          appointmentTimeSlotId: 'd4444444-4444-4444-4444-444444444444',
          startsAt: '2026-08-29T11:00:00-06:00',
          endsAt: '2026-08-29T12:00:00-06:00',
          timezone: 'America/Mexico_City',
        },
      },
      washExecution: {
        washExecutionId: 'd5555555-5555-5555-5555-555555555555',
        status: 'EXIT_SUBMITTED',
        executionVersion: 4,
        arrivedAt: '2026-08-29T16:04:00Z',
        rejectionReason: null,
        exitSubmittedAt: '2026-08-29T17:05:00Z',
        submittedExitMaterials: {
          packageCount: 2,
          greenPaperCassette8Count: 1,
          greenPaperCassette10Count: 1,
          witnessTapePortionCount: 1,
        },
      },
      activeResourceAssignment: manualAssignment,
    },
  ];
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

  getManualAppointments(): Observable<SupervisorManualAppointments> {
    const appointments = this.manualAppointments
      .filter(
        (appointment) =>
          appointment.nextAction === 'ENTRY' || appointment.nextAction === 'EXIT_REVIEW',
      )
      .sort((left, right) =>
        left.appointment.appointmentTimeSlot.startsAt.localeCompare(
          right.appointment.appointmentTimeSlot.startsAt,
        ),
      );
    return of({ serviceDate: '2026-08-29', appointments }).pipe(delay(250));
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    if (request.lookupType === 'STUDENT_ENROLLMENT') {
      const appointment = this.manualAppointments.find(
        (item) => item.student.studentEnrollment === request.studentEnrollment,
      );
      if (appointment) {
        return of(this.toLookup(appointment)).pipe(delay(250));
      }
    }
    return this.journey.lookup(request);
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    const appointment = this.manualAppointments.find(
      (item) => item.appointment.appointmentId === command.appointmentId,
    );
    if (appointment) {
      return this.acceptOperation(() => {
        this.updateManualAppointment({
          ...appointment,
          nextAction: 'ENTRY_DECISION',
          washExecution: {
            washExecutionId: `${appointment.appointment.appointmentId}-execution`,
            status: 'PENDING_ENTRY',
            executionVersion: 1,
            arrivedAt: '2026-08-29T15:00:00Z',
            rejectionReason: null,
            exitSubmittedAt: null,
            submittedExitMaterials: null,
          },
        });
      });
    }
    return this.journey.registerArrival(command);
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    const appointment = this.manualAppointments.find(
      (item) => item.washExecution?.washExecutionId === command.washExecutionId,
    );
    const execution = appointment?.washExecution;
    if (appointment && execution) {
      return this.acceptOperation(() => {
        const accepted = command.decision === 'AUTHORIZED';
        this.updateManualAppointment({
          ...appointment,
          manualSelectionStatus: accepted ? 'IN_PROGRESS' : 'REGISTERED',
          nextAction: accepted ? 'EXIT_REVIEW' : 'NONE',
          appointment: {
            ...appointment.appointment,
            appointmentStatus: accepted ? 'IN_PROGRESS' : 'ENTRY_REJECTED',
          },
          washExecution: {
            ...execution,
            status: accepted ? 'IN_PROGRESS' : 'ENTRY_REJECTED',
            executionVersion: execution.executionVersion + 1,
            rejectionReason: command.rejectionReason,
          },
          activeResourceAssignment: accepted ? manualAssignment : null,
        });
      });
    }
    return this.journey.decideEntry(command);
  }

  getPendingReassignments(): Observable<PendingReassignment[]> {
    return of(this.pendingReassignments).pipe(delay(250));
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
    this.pendingReassignments = this.pendingReassignments.filter(
      (pending) => pending.washExecutionId !== command.washExecutionId,
    );
    return this.journey.resolveReassignment(command);
  }

  cancelForCapacity(command: ClinicCancelCommand): Observable<AcceptedOperation> {
    this.pendingReassignments = this.pendingReassignments.filter(
      (pending) => pending.washExecutionId !== command.washExecutionId,
    );
    return this.journey.cancelForCapacity(command);
  }

  complete(command: CompleteWashCommand): Observable<AcceptedOperation> {
    const appointment = this.manualAppointments.find(
      (item) => item.washExecution?.washExecutionId === command.washExecutionId,
    );
    const execution = appointment?.washExecution;
    if (appointment && execution) {
      return this.acceptOperation(() => {
        this.updateManualAppointment({
          ...appointment,
          nextAction: 'NONE',
          appointment: { ...appointment.appointment, appointmentStatus: 'COMPLETED' },
          washExecution: {
            ...execution,
            status: 'COMPLETED',
            executionVersion: execution.executionVersion + 1,
          },
        });
      });
    }
    return this.journey.completeExit(command);
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

  private toLookup(appointment: SupervisorManualAppointment): SupervisorEntryLookup {
    return { serviceDate: '2026-08-29', ...appointment };
  }

  private updateManualAppointment(updated: SupervisorManualAppointment): void {
    this.manualAppointments = this.manualAppointments.map((appointment) =>
      appointment.appointment.appointmentId === updated.appointment.appointmentId
        ? updated
        : appointment,
    );
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
