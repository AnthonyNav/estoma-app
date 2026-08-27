import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'authentication',
    loadChildren: () =>
      import('./features/authentication/authentication.routes').then(
        (m) => m.AUTHENTICATION_ROUTES,
      ),
  },
  {
    path: 'home',
    loadComponent: () => import('./features/home/presentation/home.page').then((m) => m.HomePage),
  },
  {
    path: 'jornadas',
    loadChildren: () =>
      import('./features/jornadas/jornadas.routes').then((m) => m.JORNADAS_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
