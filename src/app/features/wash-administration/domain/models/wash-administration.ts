import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';

export type AdministrativeStatus = 'ACTIVE' | 'INACTIVE' | 'RETIRED';
export type CabinType = 'NORMAL' | 'JOURNEY' | 'IMMUNOCOMPROMISED';

export interface WashAdministrationHome {
  referenceDate: string;
  activeCalendar: {
    calendarId: string;
    code: string;
    name: string;
    timezone: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
  } | null;
  todaySchedule: WeeklyDay;
  weeklySchedule: WeeklyDay[];
  resourceSummary: {
    activeCabins: number;
    activeTanks: number;
    configuredActiveCapacity: number;
    activeCabinsByType: Record<CabinType, number>;
  };
  upcomingClosures: AdministrativeClosure[];
}

export interface WeeklyDay {
  dayOfWeek: number;
  intervals: ServiceInterval[];
}

export interface ServiceInterval {
  scheduleId: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
}

export interface AdministrativeClosure {
  closureId: string;
  calendar: { calendarId: string; code: string; name: string };
  scope: 'SERVICE' | 'CABIN' | 'TANK';
  startsAt: string;
  endsAt: string;
  reason: string;
  target: { resourceType: 'CABIN' | 'TANK'; resourceId: string; code: string; name: string } | null;
}

export interface CurrentWeekOperation {
  calendarId: string;
  calendarCode: string;
  calendarName: string;
  timezone: string;
  days: WeeklyDay[];
}

export interface WeekImpactPreview {
  calendarId: string;
  dayOfWeek: number;
  date: string;
  warningRequired: boolean;
  affectedTimeSlotsCount: number;
  potentiallyAffectedAppointmentsCount: number;
  snapshotGeneratedAt: string;
}

export interface ReplaceWeekDayCommand {
  calendarId: string;
  dayOfWeek: number;
  intervals: Omit<ServiceInterval, 'scheduleId'>[];
  idempotencyKey: string;
}

export interface AdminResources {
  cabins: AdminCabin[];
}

export interface AdminCabin {
  cabinId: string;
  code: string;
  name: string;
  cabinType: CabinType;
  status: AdministrativeStatus;
  tanks: AdminTank[];
}

export interface AdminTank {
  tankId: string;
  code: string;
  name: string;
  configuredCapacity: number;
  status: AdministrativeStatus;
}

export interface AdminResourceCommand {
  resourceType: 'CABIN' | 'TANK';
  resourceId: string;
  action: 'activate' | 'deactivate' | 'retire';
  idempotencyKey: string;
}

export interface AdminSupervisor {
  accountId: string;
  displayName: string;
  username: string;
  personStatus: AdministrativeStatus;
  accountStatus: AdministrativeStatus;
  washAccessStatus: AdministrativeStatus;
  effectiveAccess: boolean;
  onboardingStatus:
    | 'CONFIGURING'
    | 'WAITING_FOR_CONVERGENCE'
    | 'EMAIL_PENDING'
    | 'COMPLETED'
    | 'NEEDS_ATTENTION';
}

export interface SupervisorPersonCommand {
  fullName: string;
  institutionalEmail: string;
  username: string;
  idempotencyKey: string;
}

export type { AcceptedOperation, DurableOperation };
