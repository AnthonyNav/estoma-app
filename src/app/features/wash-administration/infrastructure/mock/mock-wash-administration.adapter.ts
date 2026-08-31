import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import {
  AcceptedOperation,
  AdminResourceCommand,
  AdminResources,
  AdminSupervisor,
  CurrentWeekOperation,
  DurableOperation,
  ReplaceWeekDayCommand,
  SupervisorPersonCommand,
  WashAdministrationHome,
  WeekImpactPreview,
} from '../../domain/models/wash-administration';
import { WashAdministrationGateway } from '../../domain/ports/wash-administration.gateway';

interface PendingOperation {
  polls: number;
  resolve: () => void;
}

const days = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  intervals:
    dayOfWeek < 6
      ? [
          {
            scheduleId: `schedule-${dayOfWeek}`,
            openingTime: '08:00:00',
            closingTime: '17:00:00',
            slotDurationMinutes: 60,
          },
        ]
      : [],
}));

@Injectable()
export class MockWashAdministrationAdapter implements WashAdministrationGateway {
  private readonly operations = new Map<string, PendingOperation>();
  private operationSequence = 0;
  private week: CurrentWeekOperation = {
    calendarId: 'calendar-1',
    calendarCode: 'WASH-2026-W35',
    calendarName: 'Semana 35',
    timezone: 'America/Mexico_City',
    days,
  };
  private resources: AdminResources = {
    cabins: [
      {
        cabinId: 'cabin-107',
        code: '107',
        name: 'Cabina 107',
        cabinType: 'NORMAL',
        status: 'ACTIVE',
        tanks: [
          { tankId: 'tank-b', code: 'B', name: 'Tina B', configuredCapacity: 2, status: 'ACTIVE' },
        ],
      },
    ],
  };
  private supervisors: AdminSupervisor[] = [
    {
      accountId: 'supervisor-1',
      displayName: 'María López',
      username: 'mlopez',
      personStatus: 'ACTIVE',
      accountStatus: 'ACTIVE',
      washAccessStatus: 'ACTIVE',
      effectiveAccess: true,
      onboardingStatus: 'COMPLETED',
    },
  ];

  loadHome(): Observable<WashAdministrationHome> {
    return of<WashAdministrationHome>({
      referenceDate: '2026-08-29',
      activeCalendar: {
        calendarId: this.week.calendarId,
        code: this.week.calendarCode,
        name: this.week.calendarName,
        timezone: this.week.timezone,
        effectiveFrom: '2026-08-24',
        effectiveUntil: '2026-08-30',
      },
      todaySchedule: this.week.days[5],
      weeklySchedule: this.week.days,
      resourceSummary: {
        activeCabins: 1,
        activeTanks: 1,
        configuredActiveCapacity: 2,
        activeCabinsByType: { NORMAL: 1, JOURNEY: 0, IMMUNOCOMPROMISED: 0 },
      },
      upcomingClosures: [],
    }).pipe(delay(250));
  }
  loadCurrentWeek(): Observable<CurrentWeekOperation> {
    return of(this.week).pipe(delay(250));
  }
  previewWeekDay(command: ReplaceWeekDayCommand): Observable<WeekImpactPreview> {
    return of({
      calendarId: command.calendarId,
      dayOfWeek: command.dayOfWeek,
      date: '2026-08-31',
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
                intervals: command.intervals.map((interval, index) => ({
                  ...interval,
                  scheduleId: `schedule-${command.dayOfWeek}-${index}`,
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
  changeResourceStatus(command: AdminResourceCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.resources = {
        cabins: this.resources.cabins.map((cabin) =>
          command.resourceType === 'CABIN' && cabin.cabinId === command.resourceId
            ? {
                ...cabin,
                status:
                  command.action === 'activate'
                    ? 'ACTIVE'
                    : command.action === 'deactivate'
                      ? 'INACTIVE'
                      : 'RETIRED',
              }
            : {
                ...cabin,
                tanks: cabin.tanks.map((tank) =>
                  command.resourceType === 'TANK' && tank.tankId === command.resourceId
                    ? {
                        ...tank,
                        status:
                          command.action === 'activate'
                            ? 'ACTIVE'
                            : command.action === 'deactivate'
                              ? 'INACTIVE'
                              : 'RETIRED',
                      }
                    : tank,
                ),
              },
        ),
      };
    });
  }
  loadSupervisors(query: string): Observable<AdminSupervisor[]> {
    const normalized = query.toLocaleLowerCase();
    return of(
      this.supervisors.filter(
        (supervisor) =>
          !normalized ||
          `${supervisor.displayName} ${supervisor.username}`
            .toLocaleLowerCase()
            .includes(normalized),
      ),
    ).pipe(delay(250));
  }
  createSupervisorPerson(command: SupervisorPersonCommand): Observable<AcceptedOperation> {
    return this.accept(() => {
      this.supervisors = [
        ...this.supervisors,
        {
          accountId: `supervisor-${this.supervisors.length + 1}`,
          displayName: command.fullName,
          username: command.username,
          personStatus: 'ACTIVE',
          accountStatus: 'INACTIVE',
          washAccessStatus: 'INACTIVE',
          effectiveAccess: false,
          onboardingStatus: 'WAITING_FOR_CONVERGENCE',
        },
      ];
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
