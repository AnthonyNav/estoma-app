import { Routes } from '@angular/router';

export const AUTHENTICATION_ROUTES: Routes = [
  {
    path: 'sign-in',
    loadComponent: () => import('./presentation/sign-in.page').then((m) => m.SignInPage),
  },
];
