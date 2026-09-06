import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApplicationError } from '../../../core/api/application-error';
import {
  AUTHENTICATION_GATEWAY,
  AuthenticationGateway,
} from '../domain/ports/authentication.gateway';
import { LoginResponse, RefreshResponse, SessionProfile } from '../domain/models/session';
import { AuthSessionService } from './auth-session.service';
import { validateSession } from './session-validation';
import { AppointmentRegistrationDraftService } from '../../wash-appointments/presentation/appointment-registration-draft.service';
function token(seconds = 900) {
  return `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.fixture`;
}
function login(restricted = false): LoginResponse {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    accessToken: token(),
    refreshToken: restricted ? null : 'fixture-refresh',
    authState: restricted ? 'PASSWORD_CHANGE_REQUIRED' : 'NORMAL',
  };
}
const profile: SessionProfile = {
  accountId: '11111111-1111-4111-8111-111111111111',
  personId: '33333333-3333-4333-8333-333333333333',
  displayName: 'Prueba',
  loginType: 'MATRICULA',
  loginIdentifier: '202257019',
  institutionalEmail: 'test@example.invalid',
  roleCode: 'ALUMNO',
  availableSystemCodes: ['LAVADO_ULTRASONICO'],
};
describe('AuthSessionService contract lifecycle', () => {
  let auth: AuthSessionService;
  let gateway: jasmine.SpyObj<AuthenticationGateway>;
  let router: jasmine.SpyObj<Router>;
  beforeEach(() => {
    gateway = jasmine.createSpyObj('gateway', [
      'signIn',
      'profile',
      'refresh',
      'changePassword',
      'logout',
    ]);
    gateway.signIn.and.returnValue(of(login()));
    gateway.profile.and.returnValue(of(profile));
    gateway.logout.and.returnValue(of({ revoked: true }));
    router = jasmine.createSpyObj('router', ['navigate']);
    router.navigate.and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTHENTICATION_GATEWAY, useValue: gateway },
        { provide: Router, useValue: router },
      ],
    });
    auth = TestBed.inject(AuthSessionService);
  });
  afterEach(() => auth.logout());
  it('keeps selected system through restricted login and password change', fakeAsync(() => {
    gateway.signIn.and.returnValue(of(login(true)));
    gateway.changePassword.and.returnValue(of(login()));
    auth.store.selectedSystemCode.set('PRACTICAS_PROFESIONALES');
    void auth.login({ identifier: '202257019', password: 'fixture' });
    flushMicrotasks();
    expect(auth.store.session()?.authState).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(gateway.profile).not.toHaveBeenCalled();
    expect(gateway.refresh).not.toHaveBeenCalled();
    void auth.changeRequiredPassword('fifteen characters plus');
    flushMicrotasks();
    expect(gateway.changePassword).toHaveBeenCalledWith(null, 'fifteen characters plus');
    expect(auth.store.session()?.authState).toBe('NORMAL');
    expect(auth.store.selectedSystemCode()).toBe('PRACTICAS_PROFESIONALES');
    auth.logout();
    flushMicrotasks();
  }));
  it('rejects a successful HTTP response with missing session fields', () => {
    expect(() => validateSession({ authState: 'NORMAL' })).toThrow();
    expect(() => validateSession({ ...login(), refreshToken: null })).toThrow();
    expect(() => validateSession({ ...login(), authState: 'UNKNOWN' })).toThrow();
  });
  it('rejects empty systems on login and revokes the provisional session', fakeAsync(() => {
    gateway.profile.and.returnValue(of({ ...profile, availableSystemCodes: [] }));
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    const accessToken = auth.store.session()!.accessToken;
    void auth.continueAfterLogin();
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
    expect(auth.store.profile()).toBeNull();
    expect(auth.store.notice()).toBe('Acceso denegado');
    expect(gateway.logout).toHaveBeenCalledOnceWith(accessToken);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/authentication/sign-in']);
  }));
  it('keeps access denied when revoking the provisional session fails', fakeAsync(() => {
    gateway.profile.and.returnValue(of({ ...profile, availableSystemCodes: [] }));
    gateway.logout.and.returnValue(throwError(() => new ApplicationError('network', 'offline', 0)));
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    void auth.continueAfterLogin();
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
    expect(auth.store.notice()).toBe('Acceso denegado');
  }));
  it('keeps session on profile 503 and supports retry', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    gateway.profile.and.returnValue(
      throwError(() => new ApplicationError('temporary', 'unavailable', 503)),
    );
    void auth.loadProfile().catch(() => undefined);
    flushMicrotasks();
    expect(auth.store.profile()).toBeNull();
    expect(auth.store.session()).not.toBeNull();
    gateway.profile.and.returnValue(of(profile));
    void auth.loadProfile();
    flushMicrotasks();
    expect(auth.store.profile()).toEqual(profile);
    auth.logout();
    flushMicrotasks();
  }));
  for (const status of [403, 503]) {
    it(`handles profile ${status} during login without entering a system`, fakeAsync(() => {
      gateway.profile.and.returnValue(
        throwError(() => new ApplicationError('temporary', 'failure', status)),
      );
      void auth.login({ identifier: 'a', password: 'b' });
      flushMicrotasks();
      void auth.continueAfterLogin();
      flushMicrotasks();
      expect(auth.store.session()).toBeNull();
      expect(auth.store.notice()).toBe(
        status === 403
          ? 'Acceso denegado'
          : 'No fue posible acceder en este momento. Intenta nuevamente.',
      );
      expect(router.navigate).toHaveBeenCalledOnceWith(['/authentication/sign-in']);
    }));
  }
  it('denies the selected system even when another system is allowed', fakeAsync(() => {
    auth.store.selectedSystemCode.set('PRACTICAS_PROFESIONALES');
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    void auth.continueAfterLogin();
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
    expect(auth.store.notice()).toBe('Acceso denegado');
    expect(gateway.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/authentication/sign-in']);
  }));
  it('shares one refresh and uses JWT exp rather than session expiresAt', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    const reply = new Subject<RefreshResponse>();
    gateway.refresh.and.returnValue(reply);
    const a = auth.refresh();
    const b = auth.refresh();
    expect(a).toBe(b);
    expect(gateway.refresh).toHaveBeenCalledTimes(1);
    reply.next({
      accessToken: token(120),
      refreshToken: 'rotated',
      expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    flushMicrotasks();
    expect(auth.store.session()?.refreshToken).toBe('rotated');
    expect(auth.store.session()!.accessExpiresAt - Date.now()).toBeLessThanOrEqual(120000);
    auth.logout();
    flushMicrotasks();
  }));
  it('late refresh cannot restore a logged-out session', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    const reply = new Subject<RefreshResponse>();
    gateway.refresh.and.returnValue(reply);
    void auth.refresh().catch(() => undefined);
    auth.logout();
    reply.next({
      accessToken: token(),
      refreshToken: 'late',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
  }));
  it('late password response cannot restore a logged-out session', fakeAsync(() => {
    gateway.signIn.and.returnValue(of(login(true)));
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    const reply = new Subject<LoginResponse>();
    gateway.changePassword.and.returnValue(reply);
    void auth.changeRequiredPassword('a long new password').catch(() => undefined);
    auth.logout();
    reply.next(login());
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
  }));
  it('expires restricted session without any refresh', fakeAsync(() => {
    gateway.signIn.and.returnValue(of({ ...login(true), accessToken: token(2) }));
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    tick(2000);
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
    expect(gateway.refresh).not.toHaveBeenCalled();
  }));
  it('rejects refresh for restricted session', fakeAsync(() => {
    gateway.signIn.and.returnValue(of(login(true)));
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    void auth.refresh().catch(() => undefined);
    flushMicrotasks();
    expect(gateway.refresh).not.toHaveBeenCalled();
    auth.logout();
    flushMicrotasks();
  }));
  it('clears session on rejected refresh', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    gateway.refresh.and.returnValue(
      throwError(() => new ApplicationError('authentication', 'invalid', 401)),
    );
    void auth.refresh().catch(() => undefined);
    flushMicrotasks();
    expect(auth.store.session()).toBeNull();
  }));
  it('clears local state immediately even when logout fails', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    gateway.logout.and.returnValue(throwError(() => new ApplicationError('network', 'offline', 0)));
    auth.logout();
    expect(auth.store.session()).toBeNull();
    flushMicrotasks();
    expect(auth.store.notice()).toBe('No fue posible acceder en este momento. Intenta nuevamente.');
  }));
  it('does not navigate into unavailable system', fakeAsync(() => {
    void auth.login({ identifier: 'a', password: 'b' });
    flushMicrotasks();
    void auth.loadProfile();
    flushMicrotasks();
    void auth.enterSystem('PRACTICAS_PROFESIONALES');
    flushMicrotasks();
    expect(router.navigate).toHaveBeenCalledWith(['/authentication/sign-in']);
    expect(auth.store.session()).toBeNull();
    expect(auth.store.notice()).toBe('Acceso denegado');
    auth.logout();
    flushMicrotasks();
  }));
  for (const end of ['logout', 'expire', 'replacement', 'denied'] as const) {
    it(`clears appointment state on ${end} before another user continues`, fakeAsync(() => {
      void auth.login({ identifier: 'first', password: 'fixture' });
      flushMicrotasks();
      const draft = TestBed.inject(AppointmentRegistrationDraftService);
      const initial = draft.draft();
      draft.acceptRegulation(true);
      draft.update({
        appointmentType: 'NORMAL',
        instrumentCount: 27,
        pieceType: 'HIGH_SPEED',
        courseSectionId: 'previous-user-course',
      });
      draft.selectTimeSlot({
        appointmentTimeSlotId: 'previous-user-slot',
        startsAt: '2026-09-06T10:00:00Z',
        endsAt: '2026-09-06T11:00:00Z',
        availableCapacity: 1,
        bookingDeadlineAt: '2026-09-06T09:00:00Z',
      });
      draft.beginSchedule({
        ...draft.draft(),
        appointmentTimeSlotId: 'previous-user-slot',
        exceptionalAuthorizationId: null,
        idempotencyKey: 'previous-user-key',
      });
      draft.setScheduleOperation('previous-user-operation');
      if (end === 'denied') {
        gateway.profile.and.returnValue(of({ ...profile, availableSystemCodes: [] }));
        void auth.continueAfterLogin();
      } else if (end !== 'replacement') auth[end]();
      flushMicrotasks();
      if (end !== 'replacement') {
        expect(draft.draft()).toEqual(initial);
        expect(draft.selectedTimeSlot()).toBeNull();
        expect(draft.pendingSchedule()).toBeNull();
      }
      gateway.signIn.and.returnValue(
        of({
          ...login(),
          accountId: '44444444-4444-4444-8444-444444444444',
        }),
      );
      void auth.login({ identifier: 'second', password: 'fixture' });
      flushMicrotasks();
      expect(draft.draft()).toEqual(initial);
      expect(draft.canContinue()).toBeFalse();
      expect(draft.selectedTimeSlot()).toBeNull();
      expect(draft.pendingSchedule()).toBeNull();
      auth.logout();
      flushMicrotasks();
    }));
  }
  for (const outcome of ['success', 'error'] as const) {
    it(`ignores an old profile ${outcome} after another login`, fakeAsync(() => {
      void auth.login({ identifier: 'first', password: 'fixture' });
      flushMicrotasks();
      const pending = new Subject<SessionProfile>();
      gateway.profile.and.returnValue(pending);
      void auth.continueAfterLogin();
      auth.logout();
      gateway.signIn.and.returnValue(
        of({
          ...login(),
          accountId: '44444444-4444-4444-8444-444444444444',
        }),
      );
      void auth.login({ identifier: 'second', password: 'fixture' });
      flushMicrotasks();
      const current = auth.store.session();
      router.navigate.calls.reset();
      gateway.logout.calls.reset();
      if (outcome === 'success') pending.next(profile);
      else pending.error(new ApplicationError('temporary', 'unavailable', 503));
      flushMicrotasks();
      expect(auth.store.session()).toBe(current);
      expect(auth.store.profile()).toBeNull();
      expect(auth.store.notice()).toBeNull();
      expect(gateway.logout).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      auth.logout();
      flushMicrotasks();
    }));
  }
  it('accepts a pending profile across automatic token renewal and preserves the draft', fakeAsync(() => {
    gateway.signIn.and.returnValue(of({ ...login(), accessToken: token(35) }));
    gateway.refresh.and.returnValue(
      of({
        accessToken: token(900),
        refreshToken: 'rotated',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    void auth.login({ identifier: 'first', password: 'fixture' });
    flushMicrotasks();
    const draft = TestBed.inject(AppointmentRegistrationDraftService);
    draft.acceptRegulation(true);
    const pending = new Subject<SessionProfile>();
    gateway.profile.and.returnValue(pending);
    void auth.continueAfterLogin();
    tick(5000);
    expect(gateway.refresh).toHaveBeenCalledTimes(1);
    pending.next(profile);
    flushMicrotasks();
    expect(auth.store.session()?.refreshToken).toBe('rotated');
    expect(auth.store.profile()).toEqual(profile);
    expect(draft.canContinue()).toBeTrue();
    expect(gateway.logout).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/wash/student']);
    auth.logout();
    flushMicrotasks();
  }));
});
