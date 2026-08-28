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
    path: 'wash/student',
    loadComponent: () =>
      import('./features/wash-student-home/presentation/student-wash-home.page').then(
        (m) => m.StudentWashHomePage,
      ),
  },
  {
    path: 'wash/appointments/regulation',
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-regulation.page').then(
        (m) => m.WashRegulationPage,
      ),
  },
  {
    path: 'wash/appointments/new',
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-appointment-form.page').then(
        (m) => m.WashAppointmentFormPage,
      ),
  },
  {
    path: 'wash/appointments/availability',
    loadComponent: () =>
      import('./features/wash-appointments/presentation/wash-appointment-availability.page').then(
        (m) => m.WashAppointmentAvailabilityPage,
      ),
  },
  {
    path: 'wash/supervision/entry',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-entry-supervision.page').then(
        (m) => m.WashEntrySupervisionPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'wash/student' },
  { path: '**', redirectTo: 'wash/student' },
];
