import { Routes } from '@angular/router';
import { washAccessGuard } from './features/authentication/application/auth.guards';

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
    path: 'wash/student',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-student-home/presentation/student-wash-home.page').then(
        (m) => m.StudentWashHomePage,
      ),
  },
  {
    path: 'wash/appointments/regulation',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-regulation.page').then(
        (m) => m.WashRegulationPage,
      ),
  },
  {
    path: 'wash/appointments/new',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-appointment-form.page').then(
        (m) => m.WashAppointmentFormPage,
      ),
  },
  {
    path: 'wash/appointments/availability',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-appointment-availability.page').then(
        (m) => m.WashAppointmentAvailabilityPage,
      ),
  },
  {
    path: 'wash/supervision/entry',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-entry-supervision.page').then(
        (m) => m.WashEntrySupervisionPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'authentication/sign-in' },
  { path: '**', redirectTo: 'authentication/sign-in' },
];
