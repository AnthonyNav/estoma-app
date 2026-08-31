import {
  AcceptedOperation,
  DurableOperation,
} from '../../../wash-appointments/domain/models/appointment-registration';

export type AdministrativeStatus = 'ACTIVE' | 'INACTIVE' | 'RETIRED';
export type CabinType = 'NORMAL' | 'JOURNEY' | 'IMMUNOCOMPROMISED';
export type WashAccessStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

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
  referenceDate: string;
  weekStart: string;
  weekEnd: string;
  calendar: {
    calendarId: string;
    code: string;
    name: string;
    timezone: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    status: 'ACTIVE' | 'INACTIVE';
  } | null;
  editing: {
    status: 'AVAILABLE' | 'NO_ACTIVE_CALENDAR' | 'CALENDAR_NOT_WEEK_SCOPED';
    blockingReason: string | null;
  };
  days: CurrentWeekDay[];
  existingClosures: AdministrativeClosure[];
}

export interface CurrentWeekDay {
  dayOfWeek: number;
  date: string;
  intervals: VersionedServiceInterval[];
}

export interface VersionedServiceInterval extends ServiceInterval {
  expectedVersion: number;
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
  expectedSchedules: { scheduleId: string; expectedVersion: number }[];
  desiredIntervals: Omit<ServiceInterval, 'scheduleId'>[];
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
  version: number;
  currentTankCount: number;
  configuredCapacity: number;
  tanks: AdminTank[];
}

export interface AdminTank {
  tankId: string;
  code: string;
  name: string;
  configuredCapacity: number;
  status: AdministrativeStatus;
  version: number;
}

export interface RegisterCabinCommand {
  cabinId: string;
  code: string;
  name: string;
  cabinType: CabinType;
  idempotencyKey: string;
}

export interface UpdateCabinCommand {
  cabinId: string;
  name: string;
  cabinType: CabinType;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface RegisterTankCommand {
  cabinId: string;
  tankId: string;
  code: string;
  name: string;
  configuredCapacity: number;
  idempotencyKey: string;
}

export interface UpdateTankCommand {
  tankId: string;
  name: string;
  configuredCapacity: number;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ChangeResourceStatusCommand {
  resourceType: 'CABIN' | 'TANK';
  resourceId: string;
  action: 'activate' | 'deactivate' | 'retire';
  expectedVersion: number;
  reason: string | null;
  idempotencyKey: string;
}

export interface AdminSupervisor {
  personId: string;
  accountId: string;
  displayName: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  institutionalEmail: string;
  username: string;
  personStatus: 'ACTIVE' | 'INACTIVE';
  accountStatus: 'ACTIVE' | 'INACTIVE';
  accountVersion: number;
  roleCode: 'SUPERVISOR_LAVADO';
  roleVersion: number;
  systemAccessId: string | null;
  washAccessStatus: WashAccessStatus | null;
  washAccessVersion: number | null;
  effectiveAccess: boolean;
  initialAccessDelivery?: {
    status: 'PENDING_DELIVERY' | 'ACCEPTED' | 'FAILED';
    expiresAt: string | null;
  } | null;
}

export interface SupervisorPersonCommand {
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  institutionalEmail: string;
  username: string;
  idempotencyKey: string;
}

export interface SuspendWashAccessCommand {
  accountId: string;
  expectedVersion: number;
  reasonCode: 'ADMINISTRATIVE_SUSPENSION';
  reasonDetail: string | null;
  idempotencyKey: string;
}

export interface RestoreWashAccessCommand {
  accountId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface RegenerateSupervisorCredentialCommand {
  accountId: string;
  idempotencyKey: string;
}

export type { AcceptedOperation, DurableOperation };
