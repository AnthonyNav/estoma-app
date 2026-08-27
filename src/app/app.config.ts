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
import { MockAuthenticationAdapter } from './features/authentication/infrastructure/mock/mock-authentication.adapter';
import { JORNADAS_GATEWAY } from './features/jornadas/domain/ports/jornadas.gateway';
import { HttpJornadasAdapter } from './features/jornadas/infrastructure/api/http-jornadas.adapter';
import { MockJornadasAdapter } from './features/jornadas/infrastructure/mock/mock-jornadas.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, apiErrorInterceptor])),
    {
      provide: AUTHENTICATION_GATEWAY,
      useClass: environment.useMockApi ? MockAuthenticationAdapter : HttpAuthenticationAdapter,
    },
    {
      provide: JORNADAS_GATEWAY,
      // platform-bff exposes no Jornadas surface yet (see HttpJornadasAdapter's
      // docstring) — same selection mechanism as authentication regardless.
      useClass: environment.useMockApi ? MockJornadasAdapter : HttpJornadasAdapter,
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
