import { Routes } from '@angular/router';
import { normalSessionGuard, requiredPasswordGuard, signInGuard } from './application/auth.guards';
export const AUTHENTICATION_ROUTES: Routes = [
  {
    path: 'sign-in',
    canActivate: [signInGuard],
    loadComponent: () => import('./presentation/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'required-password',
    canActivate: [requiredPasswordGuard],
    loadComponent: () =>
      import('./presentation/required-password.page').then((m) => m.RequiredPasswordPage),
  },
  {
    path: 'access',
    canActivate: [normalSessionGuard],
    loadComponent: () =>
      import('./presentation/session-access.page').then((m) => m.SessionAccessPage),
  },
  {
    path: 'context',
    data: { context: true },
    canActivate: [normalSessionGuard],
    loadComponent: () =>
      import('./presentation/session-access.page').then((m) => m.SessionAccessPage),
  },
];
