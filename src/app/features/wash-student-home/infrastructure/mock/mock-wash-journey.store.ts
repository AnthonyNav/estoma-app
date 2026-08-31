import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { ApplicationError } from '../../../../core/api/application-error';
import {
  AcceptedOperation,
  AppointmentAvailability,
  AppointmentFormContext,
  AvailabilityRequest,
  DurableOperation,
  ScheduleAppointmentCommand,
} from '../../../wash-appointments/domain/models/appointment-registration';
import {
  DecideWashEntryCommand,
  EntryLookupRequest,
  RegisterWashArrivalCommand,
  SupervisorLookup,
} from '../../../wash-supervision/domain/models/supervisor-entry';
import {
  ActiveResourceAssignment,
  AppointmentStatus,
  CourseSection,
  ExitMaterials,
  StudentWashAppointment,
  StudentWashHome,
  StudentWashStudent,
  WashExecution,
} from '../../domain/models/student-wash-home';
import {
  CancelStudentAppointmentCommand,
  SubmitStudentExitCommand,
} from '../../domain/ports/student-wash-home.gateway';

export type StudentHomeFixture =
  | 'loading'
  | 'no-appointment'
  | 'scheduled-no-qr'
  | 'scheduled-entry-qr'
  | 'pending-entry'
  | 'pending-reassignment'
  | 'in-progress'
  | 'exit-submitted'
  | 'completed'
  | 'cancelled'
  | 'missed'
  | 'entry-rejected'
  | 'temporary-unavailable'
  | 'forbidden'
  | 'offline';

interface PendingOperation {
  polls: number;
  resolve: () => void;
}

const student: StudentWashStudent = {
  firstName: 'Ana',
  fullName: 'Ana García Reyes',
  studentEnrollment: '201945678',
  currentSemester: 7,
};

const courseSections: CourseSection[] = [
  {
    courseSectionId: '22222222-2222-2222-2222-222222222222',
    nrc: '12345',
    name: 'Cirugía Bucal',
  },
  {
    courseSectionId: '55555555-5555-5555-5555-555555555555',
    nrc: '67890',
    name: 'Clínica Integral',
  },
];

const timeSlots = [
  {
    appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
    startsAt: '2026-08-27T11:00:00-06:00',
    endsAt: '2026-08-27T12:00:00-06:00',
    availableCapacity: 4,
    bookingDeadlineAt: '2026-08-27T10:50:00-06:00',
  },
  {
    appointmentTimeSlotId: '66666666-6666-6666-6666-666666666666',
    startsAt: '2026-08-27T12:00:00-06:00',
    endsAt: '2026-08-27T13:00:00-06:00',
    availableCapacity: 1,
    bookingDeadlineAt: '2026-08-27T11:50:00-06:00',
  },
];

const opaqueQrRepresentation = 'estoma:wash:v1:8aea7c42-72e5-4f83-a7e6-52f7e8335a19';

const resourceAssignment: ActiveResourceAssignment = {
  resourceAssignmentId: '55555555-5555-5555-5555-555555555555',
  cabinId: '66666666-6666-6666-6666-666666666666',
  cabinCode: '107',
  cabinName: 'Cabina 107',
  tankId: '77777777-7777-7777-7777-777777777777',
  tankCode: 'B',
  tankName: 'Tina B',
};

const defaultExitMaterials: ExitMaterials = {
  packageCount: 3,
  greenPaperCassette8Count: 1,
  greenPaperCassette10Count: 0,
  witnessTapePortionCount: 1,
};

@Injectable({ providedIn: 'root' })
export class MockWashJourneyStore {
  private home: StudentWashHome = this.homeWith(this.appointmentWith('SCHEDULED', true));
  private readonly operations = new Map<string, PendingOperation>();
  private fixtureWasApplied = false;
  private operationSequence = 0;

  loadStudentHome(fixture: StudentHomeFixture | null): Observable<StudentWashHome> {
    if (fixture && !this.fixtureWasApplied) {
      const fixtureResult = this.fixtureResult(fixture);
      this.fixtureWasApplied = true;

      if (fixtureResult instanceof ApplicationError) {
        return throwError(() => fixtureResult).pipe(delay(fixture === 'loading' ? 10_000 : 550));
      }

      this.home = fixtureResult;
      return of(this.home).pipe(delay(fixture === 'loading' ? 10_000 : 550));
    }

    return of(this.home).pipe(delay(250));
  }

  getFormContext(): Observable<AppointmentFormContext> {
    return of({
      student: {
        fullName: student.fullName,
        studentEnrollment: student.studentEnrollment,
        currentSemester: student.currentSemester,
      },
      availableCourseSections: courseSections,
    }).pipe(delay(300));
  }

  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability> {
    void request;
    return of({
      canSchedule: true,
      blockingReasons: [],
      dailyPenaltyPoints: 0,
      dailyCompletedAppointments: 0,
      exceptionalAuthorizationRequired: false,
      exceptionalAuthorizationAvailable: false,
      exceptionalAuthorizationId: null,
      availableTimeSlots: timeSlots,
    }).pipe(delay(450));
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    return of(
      this.createOperation(() => {
        const slot = timeSlots.find(
          (candidate) => candidate.appointmentTimeSlotId === command.appointmentTimeSlotId,
        );
        const courseSection = courseSections.find(
          (candidate) => candidate.courseSectionId === command.courseSectionId,
        );

        if (!slot || !courseSection) {
          return;
        }

        this.home = this.homeWith({
          appointmentId: '11111111-1111-1111-1111-111111111111',
          appointmentStatus: 'SCHEDULED',
          appointmentType: command.appointmentType,
          instrumentCount: command.instrumentCount,
          pieceType: command.pieceType,
          courseSection,
          timeSlot: {
            appointmentTimeSlotId: slot.appointmentTimeSlotId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            timezone: 'America/Mexico_City',
          },
          washExecution: null,
          qrUsageContext: 'ENTRY',
          qrRepresentation: opaqueQrRepresentation,
          appointmentVersion: 1,
          usesExceptionalAuthorization: false,
          studentCancellationAction: 'AVAILABLE',
        });
      }),
    ).pipe(delay(250));
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorLookup> {
    const appointment = this.home.appointment;
    const lookupValue =
      request.lookupType === 'QR' ? request.qrRepresentation : request.studentEnrollment;
    const expectedValue =
      request.lookupType === 'QR' ? opaqueQrRepresentation : student.studentEnrollment;

    if (!appointment || lookupValue !== expectedValue) {
      return throwError(
        () => new ApplicationError('not-found', 'No se encontró una cita para hoy.', 404),
      ).pipe(delay(350));
    }

    return of({
      serviceDate: this.home.serviceDate,
      nextAction: this.nextActionFor(appointment.washExecution?.status ?? null),
      student: {
        studentAccountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        displayName: student.fullName,
        studentEnrollment: student.studentEnrollment,
        currentSemester: student.currentSemester,
      },
      appointment: {
        appointmentId: appointment.appointmentId,
        appointmentStatus: appointment.appointmentStatus,
        appointmentType: appointment.appointmentType,
        instrumentCount: appointment.instrumentCount,
        pieceType: appointment.pieceType,
        courseSectionReference: appointment.courseSection,
        appointmentTimeSlot: appointment.timeSlot,
      },
      washExecution: appointment.washExecution
        ? {
            washExecutionId: appointment.washExecution.washExecutionId,
            status: appointment.washExecution.status,
            executionVersion: appointment.washExecution.executionVersion,
            arrivedAt: appointment.washExecution.arrivedAt ?? null,
            rejectionReason: appointment.washExecution.rejectionReason ?? null,
            exitSubmittedAt: appointment.washExecution.exitSubmittedAt ?? null,
            submittedExitMaterials: appointment.washExecution.submittedExitMaterials ?? null,
          }
        : null,
      activeResourceAssignment: appointment.washExecution?.activeResourceAssignment
        ? {
            resourceAssignmentId:
              appointment.washExecution.activeResourceAssignment.resourceAssignmentId,
            assignmentType: 'INITIAL' as const,
            cabin: {
              resourceId: appointment.washExecution.activeResourceAssignment.cabinId,
              code: appointment.washExecution.activeResourceAssignment.cabinCode,
              name: appointment.washExecution.activeResourceAssignment.cabinName,
            },
            tank: {
              resourceId: appointment.washExecution.activeResourceAssignment.tankId,
              code: appointment.washExecution.activeResourceAssignment.tankCode,
              name: appointment.washExecution.activeResourceAssignment.tankName,
            },
          }
        : null,
    }).pipe(delay(350));
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    return of(
      this.createOperation(() => {
        const appointment = this.home.appointment;
        if (!appointment || appointment.appointmentId !== command.appointmentId) {
          return;
        }

        this.home = this.homeWith({
          ...appointment,
          washExecution: {
            washExecutionId: '44444444-4444-4444-4444-444444444444',
            status: 'PENDING_ENTRY',
            executionVersion: 1,
            arrivedAt: '2026-08-27T10:52:00-06:00',
          },
        });
      }),
    ).pipe(delay(250));
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    return of(
      this.createOperation(() => {
        const appointment = this.home.appointment;
        if (
          !appointment ||
          appointment.washExecution?.washExecutionId !== command.washExecutionId
        ) {
          return;
        }

        if (command.decision === 'REJECTED') {
          this.home = this.homeWith({
            ...appointment,
            appointmentStatus: 'ENTRY_REJECTED',
            qrUsageContext: 'NONE',
            qrRepresentation: null,
            washExecution: {
              ...appointment.washExecution,
              status: 'ENTRY_REJECTED',
              rejectionReason: command.rejectionReason,
              activeResourceAssignment: null,
            },
          });
          return;
        }

        this.home = this.homeWith({
          ...appointment,
          appointmentStatus: 'IN_PROGRESS',
          qrUsageContext: 'STUDENT_EXIT',
          washExecution: {
            ...appointment.washExecution,
            status: 'IN_PROGRESS',
            activeResourceAssignment: resourceAssignment,
          },
        });
      }),
    ).pipe(delay(250));
  }

  cancelAppointment(command: CancelStudentAppointmentCommand): Observable<AcceptedOperation> {
    return of(
      this.createOperation(() => {
        const appointment = this.home.appointment;
        if (
          !appointment ||
          appointment.appointmentId !== command.appointmentId ||
          appointment.studentCancellationAction !== 'AVAILABLE'
        ) {
          return;
        }

        this.home = this.homeWith({
          ...appointment,
          appointmentStatus: 'CANCELLED',
          appointmentVersion: appointment.appointmentVersion
            ? appointment.appointmentVersion + 1
            : 1,
          studentCancellationAction: 'NOT_APPLICABLE',
          qrUsageContext: 'NONE',
          qrRepresentation: null,
        });
      }),
    ).pipe(delay(250));
  }

  submitExit(command: SubmitStudentExitCommand): Observable<AcceptedOperation> {
    return of(
      this.createOperation(() => {
        const appointment = this.home.appointment;
        const execution = appointment?.washExecution;
        if (
          !appointment ||
          !execution ||
          execution.washExecutionId !== command.washExecutionId ||
          execution.status !== 'IN_PROGRESS'
        ) {
          return;
        }

        this.home = this.homeWith({
          ...appointment,
          qrUsageContext: 'SUPERVISOR_EXIT_REVIEW',
          washExecution: {
            ...execution,
            status: 'EXIT_SUBMITTED',
            executionVersion: execution.executionVersion + 1,
            exitSubmittedAt: '2026-08-27T11:45:00-06:00',
            submittedExitMaterials: command.materials,
          },
        });
      }),
    ).pipe(delay(250));
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return throwError(() => new ApplicationError('not-found', 'Operación no encontrada.', 404));
    }

    operation.polls += 1;
    if (operation.polls < 2) {
      return of({ operationId, status: 'PENDING' as const }).pipe(delay(350));
    }

    operation.resolve();
    this.operations.delete(operationId);
    return of({ operationId, status: 'SUCCEEDED' as const }).pipe(delay(350));
  }

  private createOperation(resolve: () => void): AcceptedOperation {
    this.operationSequence += 1;
    const operationId = `77777777-7777-7777-7777-${String(this.operationSequence).padStart(12, '0')}`;
    this.operations.set(operationId, { polls: 0, resolve });

    return {
      operationId,
      status: 'PENDING',
      pollPath: `/api/v1/operations/${operationId}`,
      submittedAt: '2026-08-27T10:20:00-06:00',
    };
  }

  private fixtureResult(fixture: StudentHomeFixture): StudentWashHome | ApplicationError {
    switch (fixture) {
      case 'no-appointment':
        return this.homeWith(null);
      case 'scheduled-no-qr':
        return this.homeWith(this.appointmentWith('SCHEDULED', false));
      case 'scheduled-entry-qr':
      case 'loading':
        return this.homeWith(this.appointmentWith('SCHEDULED', true));
      case 'pending-entry':
        return this.homeWith(
          this.appointmentWith('SCHEDULED', true, this.execution('PENDING_ENTRY')),
        );
      case 'pending-reassignment':
        return this.homeWith(
          this.appointmentWith('SCHEDULED', true, this.execution('PENDING_REASSIGNMENT')),
        );
      case 'in-progress':
        return this.homeWith(
          this.appointmentWith(
            'IN_PROGRESS',
            true,
            this.execution('IN_PROGRESS', resourceAssignment),
          ),
        );
      case 'exit-submitted':
        return this.homeWith(
          this.appointmentWith('IN_PROGRESS', true, this.execution('EXIT_SUBMITTED')),
        );
      case 'completed':
        return this.homeWith(this.appointmentWith('COMPLETED', false, this.execution('COMPLETED')));
      case 'cancelled':
        return this.homeWith(this.appointmentWith('CANCELLED', false));
      case 'missed':
        return this.homeWith(this.appointmentWith('MISSED', false));
      case 'entry-rejected':
        return this.homeWith(
          this.appointmentWith(
            'ENTRY_REJECTED',
            false,
            this.execution('ENTRY_REJECTED', null, 'No cumple con los requisitos de ingreso.'),
          ),
        );
      case 'temporary-unavailable':
        return new ApplicationError(
          'temporary',
          'No fue posible cargar tu estado de Lavado en este momento.',
          503,
        );
      case 'forbidden':
        return new ApplicationError(
          'forbidden',
          'Tu cuenta no tiene acceso a Lavado Ultrasónico.',
          403,
        );
      case 'offline':
        return new ApplicationError(
          'network',
          'No hay conexión para actualizar tu estado de Lavado.',
        );
    }
  }

  private homeWith(appointment: StudentWashAppointment | null): StudentWashHome {
    return {
      student,
      serviceDate: '2026-08-27',
      appointment,
    };
  }

  private appointmentWith(
    appointmentStatus: AppointmentStatus,
    includeQr: boolean,
    washExecution: WashExecution | null = null,
  ): StudentWashAppointment {
    return {
      appointmentId: '11111111-1111-1111-1111-111111111111',
      appointmentStatus,
      appointmentType: 'NORMAL',
      instrumentCount: 15,
      pieceType: 'HIGH_SPEED',
      courseSection: courseSections[0],
      timeSlot: {
        appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
        startsAt: '2026-08-27T10:00:00-06:00',
        endsAt: '2026-08-27T11:00:00-06:00',
        timezone: 'America/Mexico_City',
        cancellationDeadlineAt: '2026-08-27T09:50:00-06:00',
      },
      washExecution,
      qrUsageContext: includeQr ? 'ENTRY' : 'NONE',
      qrRepresentation: includeQr ? opaqueQrRepresentation : null,
      appointmentVersion: 1,
      usesExceptionalAuthorization: false,
      studentCancellationAction: appointmentStatus === 'SCHEDULED' ? 'AVAILABLE' : 'NOT_APPLICABLE',
    };
  }

  private execution(
    status: WashExecution['status'],
    activeResourceAssignment: ActiveResourceAssignment | null = null,
    rejectionReason: string | null = null,
  ): WashExecution {
    return {
      washExecutionId: '44444444-4444-4444-4444-444444444444',
      status,
      executionVersion: 1,
      arrivedAt: status === 'PENDING_ENTRY' ? '2026-08-27T10:52:00-06:00' : null,
      activeResourceAssignment,
      rejectionReason,
      exitSubmittedAt: status === 'EXIT_SUBMITTED' ? '2026-08-27T11:45:00-06:00' : null,
      submittedExitMaterials: status === 'EXIT_SUBMITTED' ? defaultExitMaterials : null,
      completedAt: status === 'COMPLETED' ? '2026-08-27T12:00:00-06:00' : null,
      finalExitMaterials: status === 'COMPLETED' ? defaultExitMaterials : null,
      lastResourceAssignment: status === 'COMPLETED' ? resourceAssignment : null,
    };
  }

  private nextActionFor(status: WashExecution['status'] | null): SupervisorLookup['nextAction'] {
    if (!status) {
      return 'ENTRY';
    }

    const actions: Record<WashExecution['status'], SupervisorLookup['nextAction']> = {
      PENDING_ENTRY: 'ENTRY_DECISION',
      ENTRY_REJECTED: 'NONE',
      PENDING_REASSIGNMENT: 'REASSIGNMENT',
      IN_PROGRESS: 'EXIT_REVIEW',
      EXIT_SUBMITTED: 'EXIT_REVIEW',
      COMPLETED: 'NONE',
      CANCELLED: 'NONE',
    };
    return actions[status];
  }
}
