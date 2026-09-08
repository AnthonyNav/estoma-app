import { SUPERVISOR_EXIT_GATEWAY } from './features/wash-exit/domain/supervisor-exit';
import { HttpSupervisorExitAdapter } from './features/wash-exit/infrastructure/http-supervisor-exit.adapter';
import { MockSupervisorExitAdapter } from './features/wash-exit/infrastructure/mock-supervisor-exit.adapter';
import { STUDENT_EXIT_GATEWAY } from './features/wash-exit/domain/student-exit';
import { HttpStudentExitAdapter } from './features/wash-exit/infrastructure/http-student-exit.adapter';
import { MockStudentExitAdapter } from './features/wash-exit/infrastructure/mock-student-exit.adapter';
import { REASSIGNMENT_GATEWAY } from './features/wash-supervision/domain/ports/reassignment.gateway';
import { HttpReassignmentAdapter } from './features/wash-supervision/infrastructure/api/http-reassignment.adapter';
import { MockReassignmentAdapter } from './features/wash-supervision/infrastructure/mock/mock-reassignment.adapter';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { environment } from '../environments/environment';
import { apiErrorInterceptor } from './core/api/api-error.interceptor';
import { correlationIdInterceptor } from './core/api/correlation-id.interceptor';
import { routes } from './app.routes';
import { AUTHENTICATION_GATEWAY } from './features/authentication/domain/ports/authentication.gateway';
import { HttpAuthenticationAdapter } from './features/authentication/infrastructure/api/http-authentication.adapter';
import { authTransportInterceptors } from './features/authentication/infrastructure/auth-transport';
import { sessionInterceptor } from './features/authentication/infrastructure/api/session.interceptor';
import { WASH_APPOINTMENTS_GATEWAY } from './features/wash-appointments/domain/ports/wash-appointments.gateway';
import { HttpWashAppointmentsAdapter } from './features/wash-appointments/infrastructure/api/http-wash-appointments.adapter';
import { MockWashAppointmentsAdapter } from './features/wash-appointments/infrastructure/mock/mock-wash-appointments.adapter';
import { STUDENT_WASH_HOME_GATEWAY } from './features/wash-student-home/domain/ports/student-wash-home.gateway';
import { HttpStudentWashHomeAdapter } from './features/wash-student-home/infrastructure/api/http-student-wash-home.adapter';
import { MockStudentWashHomeAdapter } from './features/wash-student-home/infrastructure/mock/mock-student-wash-home.adapter';
import { WASH_SUPERVISION_GATEWAY } from './features/wash-supervision/domain/ports/wash-supervision.gateway';
import { HttpWashSupervisionAdapter } from './features/wash-supervision/infrastructure/api/http-wash-supervision.adapter';
import { MockWashSupervisionAdapter } from './features/wash-supervision/infrastructure/mock/mock-wash-supervision.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: SUPERVISOR_EXIT_GATEWAY,
      useClass: environment.useMockApi ? MockSupervisorExitAdapter : HttpSupervisorExitAdapter,
    },
    {
      provide: STUDENT_EXIT_GATEWAY,
      useClass: environment.useMockWashBooking ? MockStudentExitAdapter : HttpStudentExitAdapter,
    },
    {
      provide: REASSIGNMENT_GATEWAY,
      useExisting: environment.useMockApi ? MockReassignmentAdapter : HttpReassignmentAdapter,
    },
    HttpReassignmentAdapter,
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        sessionInterceptor,
        apiErrorInterceptor,
        correlationIdInterceptor,
        ...authTransportInterceptors,
      ]),
    ),
    {
      provide: AUTHENTICATION_GATEWAY,
      useClass: HttpAuthenticationAdapter,
    },
    {
      provide: STUDENT_WASH_HOME_GATEWAY,
      useClass: environment.useMockWashBooking
        ? MockStudentWashHomeAdapter
        : HttpStudentWashHomeAdapter,
    },
    {
      provide: WASH_APPOINTMENTS_GATEWAY,
      useClass: environment.useMockWashBooking
        ? MockWashAppointmentsAdapter
        : HttpWashAppointmentsAdapter,
    },
    {
      provide: WASH_SUPERVISION_GATEWAY,
      useClass: environment.useMockApi ? MockWashSupervisionAdapter : HttpWashSupervisionAdapter,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
