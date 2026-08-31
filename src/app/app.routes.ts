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
    path: 'wash/student/exit',
    loadComponent: () =>
      import('./features/wash-student-home/presentation/wash-exit.page').then(
        (m) => m.WashExitPage,
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
    path: 'wash/admin',
    loadComponent: () =>
      import('./features/wash-administration/presentation/wash-administration.page').then(
        (m) => m.WashAdministrationPage,
      ),
    data: { mode: 'home' },
  },
  {
    path: 'wash/admin/operation',
    loadComponent: () =>
      import('./features/wash-administration/presentation/wash-administration.page').then(
        (m) => m.WashAdministrationPage,
      ),
    data: { mode: 'week' },
  },
  {
    path: 'wash/admin/resources',
    loadComponent: () =>
      import('./features/wash-administration/presentation/wash-administration.page').then(
        (m) => m.WashAdministrationPage,
      ),
    data: { mode: 'resources' },
  },
  {
    path: 'wash/admin/supervisors',
    loadComponent: () =>
      import('./features/wash-administration/presentation/wash-administration.page').then(
        (m) => m.WashAdministrationPage,
      ),
    data: { mode: 'supervisors' },
  },
  {
    path: 'wash/supervision',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-supervisor-home.page').then(
        (m) => m.WashSupervisorHomePage,
      ),
  },
  {
    path: 'wash/supervision/entry',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-entry-supervision.page').then(
        (m) => m.WashEntrySupervisionPage,
      ),
  },
  {
    path: 'wash/supervision/reassignments',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-reassignments.page').then(
        (m) => m.WashReassignmentsPage,
      ),
  },
  {
    path: 'wash/supervision/exit',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-exit-review.page').then(
        (m) => m.WashExitReviewPage,
      ),
  },
  {
    path: 'wash/supervision/resources',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-operational-resources.page').then(
        (m) => m.WashOperationalResourcesPage,
      ),
  },
  {
    path: 'wash/supervision/exceptional-authorizations',
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-exceptional-authorization.page').then(
        (m) => m.WashExceptionalAuthorizationPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'wash/student' },
  { path: '**', redirectTo: 'wash/student' },
];
