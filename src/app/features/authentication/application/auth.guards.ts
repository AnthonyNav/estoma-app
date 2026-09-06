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
  return async () => {
    const auth = inject(AuthSessionService);
    const router = inject(Router);
    const session = auth.store.session();
    if (!session) return router.parseUrl('/authentication/sign-in');
    if (session.authState !== 'NORMAL') return router.parseUrl('/authentication/required-password');
    try {
      const profile = auth.store.profile() ?? (await auth.loadProfile());
      return (
        (profile.roleCode === role &&
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
