import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';

describe('AppointmentRegistrationDraftService reconciliation', () => {
  it('isolates a pending command by account, restores it on login and clears it after reconciliation', () => {
    const session = TestBed.inject(SessionStore);
    const registration = TestBed.inject(AppointmentRegistrationDraftService);
    const login = (accountId: string) =>
      session.session.set({
        accountId,
        sessionId: 'session',
        accessToken: 'token',
        refreshToken: null,
        authState: 'NORMAL',
        accessExpiresAt: Date.now() + 60000,
      });
    login('student-a');
    registration.beginSchedule({
      ...registration.draft(),
      appointmentTimeSlotId: 'slot',
      exceptionalAuthorizationId: null,
      idempotencyKey: 'original-key',
    });
    registration.setScheduleOperation('operation');
    session.clear();
    TestBed.inject(SessionLifecycleService).end();
    login('student-b');
    expect(registration.pendingSchedule()).toBeNull();
    session.clear();
    TestBed.inject(SessionLifecycleService).end();
    login('student-a');
    expect(registration.pendingSchedule()?.operationId).toBe('operation');
    registration.reset();
    expect(registration.pendingSchedule()).toBeNull();
  });
});
