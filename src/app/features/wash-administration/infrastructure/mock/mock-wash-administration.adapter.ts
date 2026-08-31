import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import {
  AcceptedOperation,
  AdminResources,
  AdminSupervisor,
  ChangeResourceStatusCommand,
  CurrentWeekOperation,
  DurableOperation,
  RegisterCabinCommand,
  RegisterTankCommand,
  RegenerateSupervisorCredentialCommand,
  ReplaceWeekDayCommand,
  RestoreWashAccessCommand,
  SuspendWashAccessCommand,
  SupervisorPersonCommand,
  UpdateCabinCommand,
  UpdateTankCommand,
  WashAdministrationHome,
  WeekImpactPreview,
} from '../../domain/models/wash-administration';
import { WashAdministrationGateway } from '../../domain/ports/wash-administration.gateway';

interface PendingOperation {
  polls: number;
  resolve: () => void;
}

const initialDays = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  date: `2026-08-${String(23 + dayOfWeek).padStart(2, '0')}`,
  intervals:
    dayOfWeek < 6
      ? [
          {
            scheduleId: `schedule-${dayOfWeek}`,
            openingTime: '08:00:00',
            closingTime: '17:00:00',
            slotDurationMinutes: 60,
            expectedVersion: 1,
          },
        ]
      : [],
}));

@Injectable()
export class MockWashAdministrationAdapter implements WashAdministrationGateway {
  private readonly operations = new Map<string, PendingOperation>();
  private operationSequence = 0;
  private week: CurrentWeekOperation = {
    referenceDate: '2026-08-29',
    weekStart: '2026-08-24',
    weekEnd: '2026-08-30',
    calendar: {
      calendarId: 'calendar-1',
      code: 'WASH-2026-W35',
      name: 'Semana 35',
      timezone: 'America/Mexico_City',
      effectiveFrom: '2026-08-24',
      effectiveUntil: '2026-08-30',
      status: 'ACTIVE',
    },
    editing: { status: 'AVAILABLE', blockingReason: null },
    days: initialDays,
    existingClosures: [],
  };
  private resources: AdminResources = {
    cabins: [
      {
        cabinId: 'cabin-107',
        code: '107',
        name: 'Cabina 107',
        cabinType: 'NORMAL',
        status: 'ACTIVE',
        version: 1,
        currentTankCount: 1,
        configuredCapacity: 2,
        tanks: [
          {
            tankId: 'tank-b',
            code: 'B',
            name: 'Tina B',
            configuredCapacity: 2,
            status: 'ACTIVE',
            version: 1,
          },
        ],
      },
    ],
  };
  private supervisors: AdminSupervisor[] = [
    {
      accountId: 'supervisor-1',
      personId: 'person-1',
      displayName: 'María López',
      firstName: 'María',
      paternalSurname: 'López',
      maternalSurname: null,
      institutionalEmail: 'maria.lopez@estoma.mx',
      username: 'mlopez',
      personStatus: 'ACTIVE',
      accountStatus: 'ACTIVE',
      accountVersion: 1,
      roleCode: 'SUPERVISOR_LAVADO',
      roleVersion: 1,
      systemAccessId: 'access-1',
      washAccessStatus: 'ACTIVE',
      washAccessVersion: 1,
      effectiveAccess: true,
      initialAccessDelivery: { status: 'ACCEPTED', expiresAt: '2026-08-31T18:00:00Z' },
    },
  ];

  loadHome(): Observable<WashAdministrationHome> {
    const calendar = this.week.calendar;
    return of<WashAdministrationHome>({
      referenceDate: this.week.referenceDate,
      activeCalendar: calendar
        ? {
            calendarId: calendar.calendarId,
            code: calendar.code,
            name: calendar.name,
            timezone: calendar.timezone,
            effectiveFrom: calendar.effectiveFrom,
            effectiveUntil: calendar.effectiveUntil,
          }
        : null,
      todaySchedule: this.week.days[5],
      weeklySchedule: this.week.days,
      resourceSummary: this.resourceSummary(),
      upcomingClosures: [],
    }).pipe(delay(250));
  }

  loadCurrentWeek(): Observable<CurrentWeekOperation> {
    return of(this.week).pipe(delay(250));
  }

  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview> {
    const day = this.week.days.find((candidate) => candidate.dayOfWeek === command.dayOfWeek);
    return of({
      calendarId: command.calendarId,
      dayOfWeek: command.dayOfWeek,
      date: day?.date ?? this.week.referenceDate,
      warningRequired: true,
      affectedTimeSlotsCount: 9,
      potentiallyAffectedAppointmentsCount: 2,
      snapshotGeneratedAt: '2026-08-29T18:00:00Z',
    }).pipe(delay(250));
  }

  replaceWeekDay(command: ReplaceWeekDayCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.week = {
        ...this.week,
        days: this.week.days.map((day) =>
          day.dayOfWeek === command.dayOfWeek
            ? {
                ...day,
                intervals: command.desiredIntervals.map((interval, index) => ({
                  ...interval,
                  scheduleId: `schedule-${command.dayOfWeek}-${index}`,
                  expectedVersion: 1,
                })),
              }
            : day,
        ),
      };
    });
  }

  loadResources(): Observable<AdminResources> {
    return of(this.resources).pipe(delay(250));
  }

  registerCabin(command: RegisterCabinCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.resources = {
        cabins: [
          ...this.resources.cabins,
          {
            cabinId: command.cabinId,
            code: command.code,
            name: command.name,
            cabinType: command.cabinType,
            status: 'ACTIVE',
            version: 1,
            currentTankCount: 0,
            configuredCapacity: 0,
            tanks: [],
          },
        ],
      };
    });
  }

  updateCabin(command: UpdateCabinCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.resources = {
        cabins: this.resources.cabins.map((cabin) =>
          cabin.cabinId === command.cabinId
            ? {
                ...cabin,
                name: command.name,
                cabinType: command.cabinType,
                version: cabin.version + 1,
              }
            : cabin,
        ),
      };
    });
  }

  registerTank(command: RegisterTankCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.resources = {
        cabins: this.resources.cabins.map((cabin) =>
          cabin.cabinId === command.cabinId
            ? this.withCabinMetrics({
                ...cabin,
                version: cabin.version + 1,
                tanks: [
                  ...cabin.tanks,
                  {
                    tankId: command.tankId,
                    code: command.code,
                    name: command.name,
                    configuredCapacity: command.configuredCapacity,
                    status: 'ACTIVE',
                    version: 1,
                  },
                ],
              })
            : cabin,
        ),
      };
    });
  }

  updateTank(command: UpdateTankCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.resources = {
        cabins: this.resources.cabins.map((cabin) =>
          this.withCabinMetrics({
            ...cabin,
            tanks: cabin.tanks.map((tank) =>
              tank.tankId === command.tankId
                ? {
                    ...tank,
                    name: command.name,
                    configuredCapacity: command.configuredCapacity,
                    version: tank.version + 1,
                  }
                : tank,
            ),
          }),
        ),
      };
    });
  }

  changeResourceStatus(command: ChangeResourceStatusCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      const nextStatus =
        command.action === 'activate'
          ? 'ACTIVE'
          : command.action === 'deactivate'
            ? 'INACTIVE'
            : 'RETIRED';
      this.resources = {
        cabins: this.resources.cabins.map((cabin) => {
          if (command.resourceType === 'CABIN' && cabin.cabinId === command.resourceId) {
            return { ...cabin, status: nextStatus, version: cabin.version + 1 };
          }
          return this.withCabinMetrics({
            ...cabin,
            tanks: cabin.tanks.map((tank) =>
              command.resourceType === 'TANK' && tank.tankId === command.resourceId
                ? { ...tank, status: nextStatus, version: tank.version + 1 }
                : tank,
            ),
          });
        }),
      };
    });
  }

  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    const normalized = query.toLocaleLowerCase();
    return of(
      this.supervisors.filter(
        (supervisor) =>
          !normalized ||
          `${supervisor.displayName} ${supervisor.institutionalEmail}`
            .toLocaleLowerCase()
            .includes(normalized),
      ),
    ).pipe(delay(250));
  }

  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      const accountId = `supervisor-${this.supervisors.length + 1}`;
      this.supervisors = [
        ...this.supervisors,
        {
          accountId,
          personId: `person-${this.supervisors.length + 1}`,
          displayName: [command.firstName, command.paternalSurname, command.maternalSurname]
            .filter(Boolean)
            .join(' '),
          firstName: command.firstName,
          paternalSurname: command.paternalSurname,
          maternalSurname: command.maternalSurname,
          institutionalEmail: command.institutionalEmail,
          username: command.username,
          personStatus: 'ACTIVE',
          accountStatus: 'ACTIVE',
          accountVersion: 1,
          roleCode: 'SUPERVISOR_LAVADO',
          roleVersion: 1,
          systemAccessId: `access-${this.supervisors.length + 1}`,
          washAccessStatus: 'ACTIVE',
          washAccessVersion: 1,
          effectiveAccess: true,
          initialAccessDelivery: {
            status: 'PENDING_DELIVERY',
            expiresAt: '2026-08-31T18:00:00Z',
          },
        },
      ];
    });
  }

  suspendWashAccess(command: SuspendWashAccessCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.supervisors = this.supervisors.map((supervisor) =>
        supervisor.accountId === command.accountId
          ? {
              ...supervisor,
              washAccessStatus: 'SUSPENDED',
              washAccessVersion: (supervisor.washAccessVersion ?? 0) + 1,
              effectiveAccess: false,
            }
          : supervisor,
      );
    });
  }

  restoreWashAccess(command: RestoreWashAccessCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.supervisors = this.supervisors.map((supervisor) =>
        supervisor.accountId === command.accountId
          ? {
              ...supervisor,
              washAccessStatus: 'ACTIVE',
              washAccessVersion: (supervisor.washAccessVersion ?? 0) + 1,
              effectiveAccess:
                supervisor.personStatus === 'ACTIVE' && supervisor.accountStatus === 'ACTIVE',
            }
          : supervisor,
      );
    });
  }

  regenerateSupervisorCredential(
    command: RegenerateSupervisorCredentialCommand,
  ): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.supervisors = this.supervisors.map((supervisor) =>
        supervisor.accountId === command.accountId
          ? {
              ...supervisor,
              initialAccessDelivery: {
                status: 'PENDING_DELIVERY',
                expiresAt: '2026-08-31T20:00:00Z',
              },
            }
          : supervisor,
      );
    });
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return of<DurableOperation>({ operationId, status: 'EXPIRED' });
    }
    operation.polls += 1;
    if (operation.polls < 2) {
      return of<DurableOperation>({ operationId, status: 'PENDING' }).pipe(delay(200));
    }
    operation.resolve();
    this.operations.delete(operationId);
    return of<DurableOperation>({ operationId, status: 'SUCCEEDED' }).pipe(delay(200));
  }

  private resourceSummary(): WashAdministrationHome['resourceSummary'] {
    const activeCabins = this.resources.cabins.filter((cabin) => cabin.status === 'ACTIVE');
    const activeTanks = activeCabins.flatMap((cabin) =>
      cabin.tanks.filter((tank) => tank.status === 'ACTIVE'),
    );
    return {
      activeCabins: activeCabins.length,
      activeTanks: activeTanks.length,
      configuredActiveCapacity: activeTanks.reduce((sum, tank) => sum + tank.configuredCapacity, 0),
      activeCabinsByType: {
        NORMAL: activeCabins.filter((cabin) => cabin.cabinType === 'NORMAL').length,
        JOURNEY: activeCabins.filter((cabin) => cabin.cabinType === 'JOURNEY').length,
        IMMUNOCOMPROMISED: activeCabins.filter((cabin) => cabin.cabinType === 'IMMUNOCOMPROMISED')
          .length,
      },
    };
  }

  private withCabinMetrics(
    cabin: AdminResources['cabins'][number],
  ): AdminResources['cabins'][number] {
    const currentTanks = cabin.tanks.filter((tank) => tank.status !== 'RETIRED');
    return {
      ...cabin,
      currentTankCount: currentTanks.length,
      configuredCapacity: currentTanks.reduce((sum, tank) => sum + tank.configuredCapacity, 0),
    };
  }

  private accept(resolve: () => void): Observable<AcceptedOperation> {
    this.operationSequence += 1;
    const operationId = `admin-${this.operationSequence}`;
    this.operations.set(operationId, { polls: 0, resolve });
    return of<AcceptedOperation>({
      operationId,
      status: 'PENDING',
      pollPath: `/api/v1/operations/${operationId}`,
      submittedAt: '2026-08-29T18:00:00Z',
    }).pipe(delay(200));
  }
}
