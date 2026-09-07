import {
  CompleteExitCommand,
  SupervisorExecutionDetail,
} from '../../../wash-exit/domain/supervisor-exit';
import { StudentExitCommand, validMaterials } from '../../../wash-exit/domain/student-exit';
import { environment } from '../../../../../environments/environment';
import { SupervisorHome } from '../../../wash-supervision/domain/models/supervisor-home';
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { ApplicationError } from '../../../../core/api/application-error';
import {
  CancelAppointmentCommand,
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
  SupervisorEntryLookup,
} from '../../../wash-supervision/domain/models/supervisor-entry';
import {
  ActiveResourceAssignment,
  AppointmentStatus,
  CourseSection,
  StudentWashAppointment,
  StudentWashHome,
  StudentWashStudent,
  WashExecution,
} from '../../domain/models/student-wash-home';

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
  resolve: () => string | void;
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

function todaySlots() {
  const localDay = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(date);
  const now = Date.now();
  return timeSlots
    .map((slot, index) => ({
      ...slot,
      startsAt: new Date(now + (40 + index * 45) * 60000).toISOString(),
      endsAt: new Date(now + (70 + index * 45) * 60000).toISOString(),
      bookingDeadlineAt: new Date(now + (30 + index * 45) * 60000).toISOString(),
    }))
    .filter((slot) => localDay(new Date(slot.endsAt)) === localDay(new Date(now)));
}

const opaqueQrRepresentation = 'ESTOMA-DEMO:NO-VALIDO-PARA-INGRESO';

const resourceAssignment: ActiveResourceAssignment = {
  resourceAssignmentId: '55555555-5555-5555-5555-555555555555',
  cabinId: '66666666-6666-6666-6666-666666666666',
  cabinCode: '107',
  cabinName: 'Cabina 107',
  tankId: '77777777-7777-7777-7777-777777777777',
  tankCode: 'B',
  tankName: 'Tina B',
};

const bookingScenario =
  typeof location === 'undefined'
    ? 'normal'
    : (new URLSearchParams(location.search).get('washFixture') ??
      (environment.enableSupervisorPreview && location.pathname.startsWith('/wash/supervision')
        ? 'supervisor-entry'
        : 'normal'));

@Injectable({ providedIn: 'root' })
export class MockWashJourneyStore {
  private home: StudentWashHome = this.homeWith(null);
  private readonly operations = new Map<string, PendingOperation>();
  private fixtureWasApplied = false;
  private supervisionFixtureApplied = false;
  private supervisionLag: SupervisorEntryLookup | null = null;
  private supervisionLagReads = 0;
  private readonly slots = todaySlots();
  private readonly scenario = bookingScenario;
  private availabilityCalls = 0;
  private scheduleCalls = 0;
  private homeLag = 0;
  private readonly acceptedByKey = new Map<
    string,
    { payload: string; response: AcceptedOperation }
  >();
  private readonly completed = new Map<string, DurableOperation>();

  private exitDemo: {
    command: StudentExitCommand;
    receipt: AcceptedOperation;
    home: StudentWashHome;
    result?: DurableOperation;
  } | null = this.restoreExitDemo();
  private restoreExitDemo() {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.student-exit.demo.v1') ?? 'null');
    } catch {
      return null;
    }
  }
  private saveExitDemo() {
    try {
      sessionStorage.setItem('estoma.student-exit.demo.v1', JSON.stringify(this.exitDemo));
    } catch {
      /* Demo stays in memory. */
    }
  }
  submitStudentExit(command: StudentExitCommand): Observable<AcceptedOperation> {
    if (this.exitDemo?.command.idempotencyKey === command.idempotencyKey) {
      if (JSON.stringify(this.exitDemo.command) !== JSON.stringify(command))
        return throwError(() => new ApplicationError('conflict', 'La solicitud cambió.', 409));
      return of(this.exitDemo.receipt).pipe(delay(300));
    }
    const execution = this.home.appointment?.washExecution;
    if (
      !validMaterials(command.materials) ||
      execution?.washExecutionId !== command.washExecutionId ||
      execution.status !== 'IN_PROGRESS' ||
      (execution.executionVersion ?? execution.version) !== command.expectedVersion
    )
      return throwError(
        () => new ApplicationError('validation', 'Actualiza tu cita antes de enviar.', 400),
      );
    const id = crypto.randomUUID();
    this.exitDemo = {
      command: structuredClone(command),
      receipt: {
        operationId: id,
        status: 'PENDING',
        pollPath: `/api/v1/operations/${id}`,
        submittedAt: new Date().toISOString(),
      },
      home: structuredClone(this.home),
    };
    this.saveExitDemo();
    return of(this.exitDemo.receipt).pipe(delay(400));
  }
  private completionDemo: {
    command: CompleteExitCommand;
    receipt: AcceptedOperation;
    home: StudentWashHome;
    result?: DurableOperation;
  } | null = this.restoreCompletion();
  private restoreCompletion() {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.supervisor-exit.demo.v1') ?? 'null');
    } catch {
      return null;
    }
  }
  private saveCompletion() {
    try {
      sessionStorage.setItem('estoma.supervisor-exit.demo.v1', JSON.stringify(this.completionDemo));
    } catch {
      /* Demo remains in memory. */
    }
  }
  completeStudentExit(command: CompleteExitCommand): Observable<AcceptedOperation> {
    this.ensureSupervisionFixture();
    if (this.completionDemo?.command.idempotencyKey === command.idempotencyKey) {
      if (JSON.stringify(command) !== JSON.stringify(this.completionDemo.command))
        return throwError(() => new ApplicationError('conflict', 'La intención cambió.', 409));
      return of(this.completionDemo.receipt).pipe(delay(300));
    }
    const execution = this.home.appointment?.washExecution;
    if (
      execution?.washExecutionId !== command.washExecutionId ||
      execution.status !== 'EXIT_SUBMITTED' ||
      !validMaterials(command.finalMaterials)
    )
      return throwError(
        () =>
          new ApplicationError('validation', 'La ejecución no permite completar la salida.', 400),
      );
    const id = crypto.randomUUID();
    this.completionDemo = {
      command: structuredClone(command),
      receipt: {
        operationId: id,
        status: 'PENDING',
        pollPath: `/api/v1/operations/${id}`,
        submittedAt: new Date().toISOString(),
      },
      home: structuredClone(this.home),
    };
    this.saveCompletion();
    return of(this.completionDemo.receipt).pipe(delay(400));
  }
  supervisorExecutionDetail(id: string): Observable<SupervisorExecutionDetail> {
    this.ensureSupervisionFixture();
    const view = this.supervisorView(),
      execution = this.home.appointment?.washExecution;
    if (!execution || execution.washExecutionId !== id)
      return throwError(
        () => new ApplicationError('not-found', 'No encontramos esa ejecución.', 404),
      );
    const last = execution.lastResourceAssignment;
    return of({
      student: view.student,
      appointment: view.appointment,
      washExecution: {
        washExecutionId: id,
        status: execution.status,
        executionVersion: execution.executionVersion ?? execution.version ?? 1,
        arrivedAt: execution.arrivedAt ?? new Date().toISOString(),
        rejectionReason: execution.rejectionReason ?? null,
        completedAt: execution.completedAt ?? null,
        submittedExitMaterials: execution.submittedExitMaterials ?? null,
        finalExitMaterials: execution.finalExitMaterials ?? null,
        activeResourceAssignment: view.activeResourceAssignment ?? null,
        lastResourceAssignment: last
          ? {
              resourceAssignmentId: last.resourceAssignmentId,
              assignmentType: 'INITIAL',
              cabin: { resourceId: last.cabinId, code: last.cabinCode, name: last.cabinName },
              tank: { resourceId: last.tankId, code: last.tankCode, name: last.tankName },
            }
          : null,
      },
    }).pipe(delay(350));
  }
  loadStudentHome(fixture: StudentHomeFixture | null): Observable<StudentWashHome> {
    if (this.completionDemo) {
      this.home = structuredClone(this.completionDemo.home);
      return of(this.home).pipe(delay(250));
    }
    if (this.exitDemo) {
      this.home = structuredClone(this.exitDemo.home);
      this.fixtureWasApplied = true;
      return of(this.home).pipe(delay(250));
    }
    if (fixture && !this.fixtureWasApplied) {
      const fixtureResult = this.fixtureResult(fixture);
      this.fixtureWasApplied = true;

      if (fixtureResult instanceof ApplicationError) {
        return throwError(() => fixtureResult).pipe(delay(fixture === 'loading' ? 10_000 : 550));
      }

      this.home = fixtureResult;
      return of(this.home).pipe(delay(fixture === 'loading' ? 10_000 : 550));
    }

    if (this.homeLag > 0) {
      this.homeLag--;
      return of(this.homeWith(null)).pipe(delay(250));
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
      availableCourseSections: this.scenario === 'no-courses' ? [] : courseSections,
    }).pipe(delay(300));
  }

  getAvailability(request: AvailabilityRequest): Observable<AppointmentAvailability> {
    void request;
    this.availabilityCalls++;
    if (this.scenario === 'availability-refreshing' && this.availabilityCalls <= 2)
      return throwError(
        () =>
          new ApplicationError(
            'temporary',
            'Updating',
            503,
            'BFF.PROJECTION_UNAVAILABLE',
            'fixture-availability',
            1000,
          ),
      );
    const blocked =
      this.scenario === 'blocked' ||
      !!(
        this.home.appointment &&
        !['CANCELLED', 'MISSED', 'ENTRY_REJECTED', 'COMPLETED'].includes(
          this.home.appointment.appointmentStatus,
        )
      );
    return of({
      canSchedule: !blocked,
      blockingReasons: blocked
        ? [this.home.appointment ? 'ACTIVE_APPOINTMENT_EXISTS' : 'STUDENT_BLOCKED']
        : [],
      dailyPenaltyPoints: 0,
      dailyCompletedAppointments: 0,
      exceptionalAuthorizationRequired: false,
      exceptionalAuthorizationAvailable: false,
      exceptionalAuthorizationId: null,
      availableTimeSlots: this.scenario === 'no-slots' || blocked ? [] : this.slots,
    }).pipe(delay(450));
  }

  schedule(command: ScheduleAppointmentCommand): Observable<AcceptedOperation> {
    const existing = this.acceptedByKey.get(command.idempotencyKey);
    if (existing) {
      if (existing.payload !== JSON.stringify(command))
        return throwError(
          () =>
            new ApplicationError(
              'conflict',
              'Idempotency conflict',
              409,
              'BFF.IDEMPOTENCY_CONFLICT',
            ),
        );
      return of(existing.response).pipe(delay(250));
    }
    this.scheduleCalls++;
    const accepted = this.createOperation(() => {
      const slot = this.slots.find(
        (candidate) => candidate.appointmentTimeSlotId === command.appointmentTimeSlotId,
      );
      const courseSection = courseSections.find(
        (candidate) => candidate.courseSectionId === command.courseSectionId,
      );

      if (!slot || !courseSection) {
        return;
      }

      if (this.scenario === 'home-lag') this.homeLag = 3;
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
        appointmentVersion: 1,
        usesExceptionalAuthorization: false,
        studentCancellationAction:
          this.scenario === 'cancel-deadline-passed' ? 'DEADLINE_PASSED' : 'AVAILABLE',
        qrUsageContext: this.scenario === 'qr-before-entry' ? 'NONE' : 'ENTRY',
        qrRepresentation: ['with-qr', 'qr-before-entry'].includes(this.scenario)
          ? opaqueQrRepresentation
          : null,
      });
    });
    this.acceptedByKey.set(command.idempotencyKey, {
      payload: JSON.stringify(command),
      response: accepted,
    });
    if (this.scenario === 'schedule-offline' && this.scheduleCalls === 1)
      return throwError(() => new ApplicationError('network', 'La conexión se interrumpió.', 0));
    return of(accepted).pipe(delay(250));
  }

  private ensureSupervisionFixture(): void {
    if (this.entryDemo && !this.exitDemo && !this.completionDemo) {
      this.home = structuredClone(this.entryDemo.home);
      return;
    }
    if (this.completionDemo) {
      this.home = structuredClone(this.completionDemo.home);
      return;
    }
    if (this.exitDemo) {
      this.home = structuredClone(this.exitDemo.home);
      return;
    }
    if (!this.supervisionFixtureApplied && this.scenario === 'supervisor-exit') {
      this.supervisionFixtureApplied = true;
      this.home = this.homeWith(
        this.appointmentWith(
          'IN_PROGRESS',
          true,
          this.execution('EXIT_SUBMITTED', resourceAssignment),
        ),
      );
      return;
    }
    if (!this.supervisionFixtureApplied && this.scenario.startsWith('supervisor-')) {
      this.supervisionFixtureApplied = true;
      const appointment = this.appointmentWith('SCHEDULED', true);
      this.home = this.homeWith({
        ...appointment,
        appointmentVersion: 1,
        studentCancellationAction: 'AVAILABLE',
        usesExceptionalAuthorization: false,
        timeSlot: {
          appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
          startsAt: new Date(Date.now() - 5 * 60000).toISOString(),
          endsAt: new Date(Date.now() + 55 * 60000).toISOString(),
          timezone: 'America/Mexico_City',
        },
      });
    }
  }

  supervisorHome(): Observable<SupervisorHome> {
    this.ensureSupervisionFixture();
    const status = this.home.appointment?.appointmentStatus;
    return of({
      serviceDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
        new Date(),
      ),
      pendingReassignmentsCount:
        this.home.appointment?.washExecution?.status === 'PENDING_REASSIGNMENT' ? 1 : 0,
      summary: {
        registeredAppointments: 11 + Number(status === 'SCHEDULED'),
        inProcessAppointments: 5 + Number(status === 'IN_PROGRESS'),
        completedAppointments: 4 + Number(status === 'COMPLETED'),
        deniedAppointments: 1 + Number(status === 'ENTRY_REJECTED'),
        cancelledAppointments: Number(status === 'CANCELLED'),
      },
    }).pipe(delay(350));
  }

  private directoryExamples: SupervisorEntryLookup[] | null = null;
  private extraDirectoryEntries(): SupervisorEntryLookup[] {
    if (this.directoryExamples) return this.directoryExamples;
    const base = this.supervisorView();
    this.directoryExamples = [
      ['Carlos Mendoza López', '201945679', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      ['María Torres Ruiz', '201945680', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
    ].map(([displayName, studentEnrollment, id]) => ({
      ...structuredClone(base),
      nextAction: 'EXIT_REVIEW',
      student: { ...base.student, displayName, studentEnrollment, studentAccountId: id },
      appointment: {
        ...structuredClone(base.appointment),
        appointmentId: id,
        appointmentStatus: 'IN_PROGRESS',
      },
      washExecution: {
        washExecutionId: id,
        executionVersion: 2,
        status: 'IN_PROGRESS',
        arrivedAt: new Date().toISOString(),
      },
      activeResourceAssignment:
        this.scenario === 'supervisor-exit' ? structuredClone(base.activeResourceAssignment) : null,
    }));
    return this.directoryExamples;
  }

  supervisorDirectory(): Observable<SupervisorEntryLookup[]> {
    this.ensureSupervisionFixture();
    if (!this.home.appointment) return of([]).pipe(delay(250));
    return of(
      [this.supervisorView(), ...this.extraDirectoryEntries()].filter((row) =>
        ['SCHEDULED', 'IN_PROGRESS'].includes(row.appointment.appointmentStatus),
      ),
    ).pipe(delay(350));
  }

  lookup(request: EntryLookupRequest): Observable<SupervisorEntryLookup> {
    this.ensureSupervisionFixture();
    if (request.lookupType === 'STUDENT_ENROLLMENT' && this.home.appointment) {
      const extra = this.extraDirectoryEntries().find(
        (row) => row.student.studentEnrollment === request.studentEnrollment,
      );
      if (extra) return of(structuredClone(extra)).pipe(delay(350));
    }
    const lookupValue =
      request.lookupType === 'QR' ? request.qrRepresentation : request.studentEnrollment;
    const expectedValue =
      request.lookupType === 'QR' ? opaqueQrRepresentation : student.studentEnrollment;
    if (!this.home.appointment || lookupValue !== expectedValue)
      return throwError(
        () =>
          new ApplicationError(
            'not-found',
            'No encontramos una cita de hoy para ese alumno. Revisa la matrícula.',
            404,
          ),
      );
    if (this.supervisionLag && this.supervisionLagReads-- > 0)
      return of(this.supervisionLag).pipe(delay(350));
    return of(this.supervisorView()).pipe(delay(350));
  }

  private supervisorView(): SupervisorEntryLookup {
    const appointment = this.home.appointment!;
    const execution = appointment.washExecution;
    const assignment = execution?.activeResourceAssignment;
    return {
      serviceDate: this.home.serviceDate,
      nextAction:
        execution?.status === 'PENDING_ENTRY'
          ? 'ENTRY_DECISION'
          : execution?.status === 'PENDING_REASSIGNMENT'
            ? 'REASSIGNMENT'
            : ['IN_PROGRESS', 'EXIT_SUBMITTED'].includes(execution?.status ?? '')
              ? 'EXIT_REVIEW'
              : !execution && appointment.appointmentStatus === 'SCHEDULED'
                ? 'ENTRY'
                : 'NONE',
      student: {
        studentAccountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        displayName: student.fullName,
        studentEnrollment: student.studentEnrollment,
        currentSemester: student.currentSemester ?? 7,
      },
      appointment: {
        appointmentId: appointment.appointmentId,
        appointmentStatus: appointment.appointmentStatus,
        appointmentType: appointment.appointmentType,
        instrumentCount: appointment.instrumentCount ?? 15,
        pieceType: appointment.pieceType ?? 'HIGH_SPEED',
        courseSectionReference: appointment.courseSection as CourseSection,
        appointmentTimeSlot:
          appointment.timeSlot as SupervisorEntryLookup['appointment']['appointmentTimeSlot'],
      },
      washExecution: execution
        ? {
            washExecutionId: execution.washExecutionId,
            status: execution.status,
            executionVersion: execution.version ?? 1,
            arrivedAt: execution.arrivedAt ?? new Date().toISOString(),
            rejectionReason: execution.rejectionReason ?? null,
            exitSubmittedAt: execution.exitSubmittedAt ?? null,
            submittedExitMaterials: execution.submittedExitMaterials ?? null,
          }
        : null,
      activeResourceAssignment: assignment
        ? {
            resourceAssignmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            assignmentType: 'INITIAL',
            cabin: {
              resourceId: assignment.cabinId,
              code: assignment.cabinCode,
              name: assignment.cabinName,
            },
            tank: {
              resourceId: assignment.tankId,
              code: assignment.tankCode,
              name: assignment.tankName,
            },
          }
        : null,
    };
  }

  private entryDemo: {
    home: StudentWashHome;
    records: Record<
      string,
      {
        kind: string;
        command: RegisterWashArrivalCommand | DecideWashEntryCommand;
        receipt: AcceptedOperation;
        result?: DurableOperation;
      }
    >;
  } | null = this.restoreEntryDemo();
  private restoreEntryDemo() {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.entry.demo.v2') ?? 'null');
    } catch {
      return null;
    }
  }
  private saveEntryDemo() {
    if (this.entryDemo) {
      this.entryDemo.home = structuredClone(this.home);
      try {
        sessionStorage.setItem('estoma.entry.demo.v2', JSON.stringify(this.entryDemo));
      } catch {
        /* Demo stays in memory. */
      }
    }
  }
  private submitSupervision(
    kind: string,
    command: RegisterWashArrivalCommand | DecideWashEntryCommand,
    resolve: () => string | void,
  ): Observable<AcceptedOperation> {
    const key = `${kind}:${command.idempotencyKey}`;
    const saved = this.entryDemo?.records[key];
    if (saved) {
      if (JSON.stringify(saved.command) !== JSON.stringify(command))
        return throwError(() => new ApplicationError('conflict', 'La intención cambió.', 409));
      if (!saved.result && !this.operations.has(saved.receipt.operationId)) {
        this.home = structuredClone(this.entryDemo!.home);
        this.operations.set(saved.receipt.operationId, { polls: 0, resolve });
      }
      return of(saved.receipt).pipe(delay(250));
    }
    const existing = this.acceptedByKey.get(key);
    if (existing)
      return existing.payload === JSON.stringify(command)
        ? of(existing.response).pipe(delay(250))
        : throwError(
            () =>
              new ApplicationError(
                'conflict',
                'La referencia corresponde a otra solicitud.',
                409,
                'BFF.IDEMPOTENCY_CONFLICT',
              ),
          );
    const accepted = this.createOperation(() => {
      const before = this.home.appointment ? this.supervisorView() : null;
      const error = resolve();
      if (!error && this.scenario === 'supervisor-lag') {
        this.supervisionLag = before;
        this.supervisionLagReads = 3;
      }
      return error;
    });
    this.acceptedByKey.set(key, { payload: JSON.stringify(command), response: accepted });
    this.entryDemo ??= { home: structuredClone(this.home), records: {} };
    this.entryDemo.records[key] = { kind, command: structuredClone(command), receipt: accepted };
    this.saveEntryDemo();
    if (this.scenario === 'supervisor-offline')
      return throwError(() => new ApplicationError('network', 'Se interrumpió la conexión.', 0));
    return of(accepted).pipe(delay(250));
  }

  registerArrival(command: RegisterWashArrivalCommand): Observable<AcceptedOperation> {
    return this.submitSupervision('arrival', command, () => {
      const appointment = this.home.appointment;
      if (
        !appointment ||
        appointment.appointmentId !== command.appointmentId ||
        appointment.appointmentStatus !== 'SCHEDULED'
      )
        return 'APPOINTMENT_NOT_SCHEDULED';
      if (appointment.washExecution) return 'WASH_EXECUTION_ALREADY_EXISTS';
      if (this.scenario === 'supervisor-too-early') return 'ARRIVAL_TOO_EARLY';
      this.home = this.homeWith({
        ...appointment,
        washExecution: {
          washExecutionId: '44444444-4444-4444-4444-444444444444',
          status: 'PENDING_ENTRY',
          version: 1,
          executionVersion: 1,
          arrivedAt: new Date().toISOString(),
        },
      });
      return undefined;
    });
  }

  decideEntry(command: DecideWashEntryCommand): Observable<AcceptedOperation> {
    return this.submitSupervision('decision', command, () => {
      const appointment = this.home.appointment;
      const execution = appointment?.washExecution;
      if (
        !appointment ||
        !execution ||
        execution.washExecutionId !== command.washExecutionId ||
        execution.status !== 'PENDING_ENTRY'
      )
        return 'INVALID_ENTRY_DECISION';
      if (execution.version !== command.expectedVersion) return 'VERSION_CONFLICT';
      if (
        command.decision === 'AUTHORIZED' &&
        (!command.identityConfirmed || !command.requirementsSatisfied)
      )
        return 'INVALID_ENTRY_DECISION';
      if (
        command.decision === 'REJECTED' &&
        (!command.rejectionReason?.trim() ||
          (command.identityConfirmed && command.requirementsSatisfied))
      )
        return 'INVALID_ENTRY_DECISION';
      const rejected = command.decision === 'REJECTED';
      const waiting = !rejected && this.scenario === 'supervisor-no-resources';
      this.home = this.homeWith({
        ...appointment,
        appointmentStatus: rejected ? 'ENTRY_REJECTED' : waiting ? 'SCHEDULED' : 'IN_PROGRESS',
        qrRepresentation: rejected ? null : appointment.qrRepresentation,
        qrUsageContext: rejected || waiting ? 'NONE' : 'STUDENT_EXIT',
        washExecution: {
          ...execution,
          version: command.expectedVersion + 1,
          executionVersion: command.expectedVersion + 1,
          status: rejected ? 'ENTRY_REJECTED' : waiting ? 'PENDING_REASSIGNMENT' : 'IN_PROGRESS',
          rejectionReason: command.rejectionReason,
          activeResourceAssignment: rejected || waiting ? null : resourceAssignment,
        },
      });
      return undefined;
    });
  }

  cancel(command: CancelAppointmentCommand): Observable<AcceptedOperation> {
    const key = `cancel:${command.idempotencyKey}`;
    const existing = this.acceptedByKey.get(key);
    if (existing) {
      return existing.payload === JSON.stringify(command)
        ? of(existing.response).pipe(delay(250))
        : throwError(
            () => new ApplicationError('conflict', 'La clave corresponde a otra solicitud.', 409),
          );
    }
    const appointment = this.home.appointment;
    if (
      !appointment ||
      appointment.appointmentId !== command.appointmentId ||
      appointment.appointmentVersion !== command.expectedVersion ||
      appointment.studentCancellationAction !== 'AVAILABLE'
    ) {
      return throwError(
        () =>
          new ApplicationError(
            'conflict',
            'La cita cambió. Actualiza tu estado antes de cancelar.',
            409,
          ),
      );
    }
    const accepted = this.createOperation(() => {
      this.home = this.homeWith({
        ...appointment,
        appointmentStatus: 'CANCELLED',
        appointmentVersion: command.expectedVersion + 1,
        studentCancellationAction: 'NOT_APPLICABLE',
        qrRepresentation: null,
        qrUsageContext: 'NONE',
      });
    });
    this.acceptedByKey.set(key, { payload: JSON.stringify(command), response: accepted });
    return of(accepted).pipe(delay(250));
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    if (this.completionDemo?.receipt.operationId === operationId) {
      const demo = this.completionDemo;
      if (demo.result) return of(demo.result).pipe(delay(250));
      if (Date.now() - Date.parse(demo.receipt.submittedAt) < 1500)
        return of({ operationId, status: 'PENDING' as const }).pipe(delay(250));
      const appointment = demo.home.appointment!,
        execution = appointment.washExecution!;
      if ((execution.executionVersion ?? execution.version) !== demo.command.expectedVersion) {
        demo.result = { operationId, status: 'REJECTED', errorCode: 'VERSION_CONFLICT' };
      } else {
        appointment.appointmentStatus = 'COMPLETED';
        appointment.qrRepresentation = null;
        appointment.qrUsageContext = 'NONE';
        execution.status = 'COMPLETED';
        execution.executionVersion = demo.command.expectedVersion + 1;
        execution.version = execution.executionVersion;
        execution.completedAt = new Date().toISOString();
        execution.finalExitMaterials = structuredClone(demo.command.finalMaterials);
        execution.lastResourceAssignment = execution.activeResourceAssignment;
        execution.activeResourceAssignment = null;
        demo.result = { operationId, status: 'SUCCEEDED', data: { status: 'COMPLETED' } };
      }
      this.home = structuredClone(demo.home);
      this.saveCompletion();
      return of(demo.result).pipe(delay(350));
    }
    if (this.exitDemo?.receipt.operationId === operationId) {
      if (this.exitDemo.result) return of(this.exitDemo.result).pipe(delay(250));
      if (Date.now() - Date.parse(this.exitDemo.receipt.submittedAt) < 1500)
        return of({ operationId, status: 'PENDING' as const }).pipe(delay(250));
      const appointment = this.exitDemo.home.appointment!;
      appointment.washExecution = {
        ...appointment.washExecution!,
        status: 'EXIT_SUBMITTED',
        executionVersion: this.exitDemo.command.expectedVersion + 1,
        version: this.exitDemo.command.expectedVersion + 1,
        submittedExitMaterials: structuredClone(this.exitDemo.command.materials),
        exitSubmittedAt: new Date().toISOString(),
      };
      appointment.qrUsageContext = 'SUPERVISOR_EXIT_REVIEW';
      this.exitDemo.result = {
        operationId,
        status: 'SUCCEEDED',
        data: { status: 'EXIT_SUBMITTED' },
      };
      this.home = structuredClone(this.exitDemo.home);
      this.saveExitDemo();
      return of(this.exitDemo.result).pipe(delay(300));
    }
    const record = Object.values(this.entryDemo?.records ?? {}).find(
      (r) => r.receipt.operationId === operationId,
    );
    if (record?.result) return of(record.result).pipe(delay(250));
    if (record && !this.operations.has(operationId)) {
      this.home = structuredClone(this.entryDemo!.home);
      if (record.kind === 'arrival')
        this.registerArrival(record.command as RegisterWashArrivalCommand);
      else this.decideEntry(record.command as DecideWashEntryCommand);
    }
    const completed = this.completed.get(operationId);
    if (completed) return of(completed).pipe(delay(250));
    const operation = this.operations.get(operationId);
    if (!operation) {
      return throwError(() => new ApplicationError('not-found', 'Operación no encontrada.', 404));
    }

    operation.polls += 1;
    if (
      operation.polls < 2 ||
      ['operation-pending', 'supervisor-pending'].includes(this.scenario)
    ) {
      return of({ operationId, status: 'PENDING' as const }).pipe(delay(350));
    }

    const rejected = this.scenario === 'schedule-rejected' && this.scheduleCalls === 1;
    const failed = ['operation-failed', 'supervisor-failed'].includes(this.scenario);
    const ownerError = !rejected && !failed ? operation.resolve() : undefined;
    this.operations.delete(operationId);
    const result: DurableOperation = {
      operationId,
      status: failed ? 'FAILED' : rejected || ownerError ? 'REJECTED' : 'SUCCEEDED',
      errorCode: ownerError || (rejected ? 'CAPACITY_EXHAUSTED' : null),
      data:
        rejected || failed || ownerError
          ? null
          : {
              status: this.home.appointment?.washExecution?.status,
              aggregateId: '11111111-1111-1111-1111-111111111111',
              aggregateVersion: 1,
            },
    };
    this.completed.set(operationId, result);
    if (record) {
      record.result = result;
      this.saveEntryDemo();
    }
    return of(result).pipe(delay(350));
  }

  private createOperation(resolve: () => string | void): AcceptedOperation {
    const operationId = crypto.randomUUID();
    this.operations.set(operationId, { polls: 0, resolve });

    return {
      operationId,
      status: 'PENDING',
      pollPath: `/api/v1/operations/${operationId}`,
      submittedAt: new Date().toISOString(),
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
      serviceDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
        new Date(),
      ),
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
      },
      washExecution,
      qrUsageContext: !includeQr
        ? 'NONE'
        : washExecution?.status === 'IN_PROGRESS'
          ? 'STUDENT_EXIT'
          : washExecution?.status === 'EXIT_SUBMITTED'
            ? 'SUPERVISOR_EXIT_REVIEW'
            : 'ENTRY',
      qrRepresentation: includeQr ? opaqueQrRepresentation : null,
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
      version: 1,
      executionVersion: 1,
      submittedExitMaterials: ['EXIT_SUBMITTED', 'COMPLETED'].includes(status)
        ? {
            packageCount: 2,
            greenPaperCassette8Count: 1,
            greenPaperCassette10Count: 0,
            witnessTapePortionCount: 2,
          }
        : null,
      finalExitMaterials:
        status === 'COMPLETED'
          ? {
              packageCount: 2,
              greenPaperCassette8Count: 1,
              greenPaperCassette10Count: 1,
              witnessTapePortionCount: 2,
            }
          : null,
      exitSubmittedAt: ['EXIT_SUBMITTED', 'COMPLETED'].includes(status)
        ? new Date().toISOString()
        : null,
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      lastResourceAssignment: status === 'COMPLETED' ? resourceAssignment : null,
      arrivedAt: status === 'PENDING_ENTRY' ? '2026-08-27T10:52:00-06:00' : null,
      activeResourceAssignment,
      rejectionReason,
    };
  }
}
