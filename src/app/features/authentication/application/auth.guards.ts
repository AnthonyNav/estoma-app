import { environment } from '../../../../environments/environment';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { SessionStore } from './session-store.service';
export const normalSessionGuard: CanActivateFn = () => {
  const state = inject(SessionStore).session()?.authState;
  return (
    state === 'NORMAL' ||
    inject(Router).parseUrl(
      state === 'PASSWORD_CHANGE_REQUIRED'
        ? '/authentication/required-password'
        : '/authentication/sign-in',
    )
  );
};
export const requiredPasswordGuard: CanActivateFn = () => {
  const state = inject(SessionStore).session()?.authState;
  return (
    state === 'PASSWORD_CHANGE_REQUIRED' ||
    inject(Router).parseUrl(
      state === 'NORMAL' ? '/authentication/access' : '/authentication/sign-in',
    )
  );
};
export const signInGuard: CanActivateFn = () => {
  const state = inject(SessionStore).session()?.authState;
  return (
    !state ||
    inject(Router).parseUrl(
      state === 'NORMAL' ? '/authentication/access' : '/authentication/required-password',
    )
  );
};
export function washAccessGuard(role: string): CanActivateFn {
  return async (route) => {
    const auth = inject(AuthSessionService);
    const router = inject(Router);
    if (
      !auth.store.session() &&
      (role === 'SUPERVISOR_LAVADO' ||
        (role === 'ALUMNO' && route.queryParamMap.get('preview') === 'student-exit')) &&
      environment.enableSupervisorPreview &&
      !environment.production &&
      environment.useMockApi &&
      environment.useMockWashBooking
    ) {
      try {
        auth.store.selectedSystemCode.set('LAVADO_ULTRASONICO');
        await auth.login({
          identifier: role === 'ALUMNO' ? '202257019' : 'supervisor',
          password: 'demo-local',
        });
      } catch {
        return router.parseUrl('/authentication/sign-in');
      }
    }
    const session = auth.store.session();
    if (!session) return router.parseUrl('/authentication/sign-in');
    if (session.authState !== 'NORMAL') return router.parseUrl('/authentication/required-password');
    try {
      const profile = auth.store.profile() ?? (await auth.loadProfile());
      return (
        (auth.store.selectedSystemCode() === 'LAVADO_ULTRASONICO' &&
          profile.roleCode === role &&
          profile.availableSystemCodes.includes('LAVADO_ULTRASONICO')) ||
        router.parseUrl('/authentication/access')
      );
    } catch {
      return router.parseUrl(
        auth.store.session() ? '/authentication/access' : '/authentication/sign-in',
      );
    }
  };
}
