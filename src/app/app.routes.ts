import { firstValueFrom, isObservable } from 'rxjs';
import { SupervisorExitService } from './features/wash-exit/application/supervisor-exit.service';
import { SupervisorEntryWorkflowService } from './features/wash-supervision/application/supervisor-entry-workflow.service';
import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { washAccessGuard } from './features/authentication/application/auth.guards';

export const routes: Routes = [
  {
    path: 'authentication',
    loadChildren: () =>
      import('./features/authentication/authentication.routes').then(
        (m) => m.AUTHENTICATION_ROUTES,
      ),
  },
  { path: 'home', pathMatch: 'full', redirectTo: 'authentication/sign-in' },
  {
    path: 'wash/student',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-student-home/presentation/student-wash-home.page').then(
        (m) => m.StudentWashHomePage,
      ),
  },
  {
    path: 'wash/student/exit',
    canActivate: [washAccessGuard('ALUMNO')],
    loadComponent: () =>
      import('./features/wash-exit/presentation/student-exit.page').then((m) => m.StudentExitPage),
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
    path: 'wash/supervision',
    pathMatch: 'full',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/supervisor-home.page').then(
        (m) => m.SupervisorHomePage,
      ),
  },
  {
    path: 'wash/supervision/reassignments',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/reassignments.page').then(
        (m) => m.ReassignmentsPage,
      ),
  },
  {
    path: 'wash/supervision/exit',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-exit/presentation/supervisor-exit.page').then(
        (m) => m.SupervisorExitPage,
      ),
  },
  {
    path: 'wash/supervision/manual',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/supervisor-directory.page').then(
        (m) => m.SupervisorDirectoryPage,
      ),
  },
  {
    path: 'wash/supervision/scan',
    canActivate: [washAccessGuard('SUPERVISOR_LAVADO')],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/supervisor-scanner.page').then(
        (m) => m.SupervisorScannerPage,
      ),
  },
  {
    path: 'wash/supervision/entry',
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    canActivate: [
      async (route, state) => {
        const exits = inject(SupervisorExitService);
        const flow = inject(SupervisorEntryWorkflowService);
        const router = inject(Router);
        const access = washAccessGuard('SUPERVISOR_LAVADO')(route, state);
        const allowed = isObservable(access) ? await firstValueFrom(access) : await access;
        if (allowed !== true) return allowed;
        if (exits.pending()) return router.parseUrl('/wash/supervision/exit');
        if (route.queryParamMap.get('method') === 'qr')
          return router.parseUrl('/wash/supervision/scan');
        return (
          !!(flow.lookup() || flow.pending() || flow.busy() || flow.error()) ||
          router.parseUrl('/wash/supervision/manual')
        );
      },
    ],
    loadComponent: () =>
      import('./features/wash-supervision/presentation/wash-entry-supervision.page').then(
        (m) => m.WashEntrySupervisionPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'authentication/sign-in' },
  { path: '**', redirectTo: 'authentication/sign-in' },
];
