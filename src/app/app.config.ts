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
import { authTokenInterceptor } from './core/api/auth-token.interceptor';
import { correlationIdInterceptor } from './core/api/correlation-id.interceptor';
import { routes } from './app.routes';
import { AUTHENTICATION_GATEWAY } from './features/authentication/domain/ports/authentication.gateway';
import { HttpAuthenticationAdapter } from './features/authentication/infrastructure/api/http-authentication.adapter';
import { MockAuthenticationAdapter } from './features/authentication/infrastructure/mock/mock-authentication.adapter';
import { WASH_APPOINTMENTS_GATEWAY } from './features/wash-appointments/domain/ports/wash-appointments.gateway';
import { HttpWashAppointmentsAdapter } from './features/wash-appointments/infrastructure/api/http-wash-appointments.adapter';
import { MockWashAppointmentsAdapter } from './features/wash-appointments/infrastructure/mock/mock-wash-appointments.adapter';
import { STUDENT_WASH_HOME_GATEWAY } from './features/wash-student-home/domain/ports/student-wash-home.gateway';
import { HttpStudentWashHomeAdapter } from './features/wash-student-home/infrastructure/api/http-student-wash-home.adapter';
import { MockStudentWashHomeAdapter } from './features/wash-student-home/infrastructure/mock/mock-student-wash-home.adapter';
import { WASH_SUPERVISION_GATEWAY } from './features/wash-supervision/domain/ports/wash-supervision.gateway';
import { HttpWashSupervisionAdapter } from './features/wash-supervision/infrastructure/api/http-wash-supervision.adapter';
import { MockWashSupervisionAdapter } from './features/wash-supervision/infrastructure/mock/mock-wash-supervision.adapter';
import { WASH_ADMINISTRATION_GATEWAY } from './features/wash-administration/domain/ports/wash-administration.gateway';
import { HttpWashAdministrationAdapter } from './features/wash-administration/infrastructure/api/http-wash-administration.adapter';
import { MockWashAdministrationAdapter } from './features/wash-administration/infrastructure/mock/mock-wash-administration.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, authTokenInterceptor, apiErrorInterceptor]),
    ),
    {
      provide: AUTHENTICATION_GATEWAY,
      useClass: environment.useMockApi ? MockAuthenticationAdapter : HttpAuthenticationAdapter,
    },
    {
      provide: STUDENT_WASH_HOME_GATEWAY,
      useClass: environment.useMockApi ? MockStudentWashHomeAdapter : HttpStudentWashHomeAdapter,
    },
    {
      provide: WASH_APPOINTMENTS_GATEWAY,
      useClass: environment.useMockApi ? MockWashAppointmentsAdapter : HttpWashAppointmentsAdapter,
    },
    {
      provide: WASH_SUPERVISION_GATEWAY,
      useClass: environment.useMockApi ? MockWashSupervisionAdapter : HttpWashSupervisionAdapter,
    },
    {
      provide: WASH_ADMINISTRATION_GATEWAY,
      useClass: environment.useMockApi
        ? MockWashAdministrationAdapter
        : HttpWashAdministrationAdapter,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
