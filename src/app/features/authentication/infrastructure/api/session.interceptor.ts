import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ApplicationError } from '../../../../core/api/application-error';
import { AuthSessionService } from '../../application/auth-session.service';
import { SessionStore } from '../../application/session-store.service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const path = request.url.split('?')[0];
  if (
    !path.startsWith(`${environment.apiBaseUrl}/`) ||
    path.startsWith(`${environment.apiBaseUrl}/auth/`)
  )
    return next(request);
  const store = inject(SessionStore);
  const auth = inject(AuthSessionService);
  const session = store.session();
  if (!session) return next(request);
  const send = () => {
    const current = store.session();
    if (!current)
      return throwError(() => new ApplicationError('authentication', 'Sesión finalizada.', 401));
    const revision = store.revision;
    return next(
      request.clone({ setHeaders: { Authorization: `Bearer ${current.accessToken}` } }),
    ).pipe(
      catchError((error) => {
        if (
          error instanceof ApplicationError &&
          error.status === 401 &&
          store.revision === revision
        )
          auth.expire();
        return throwError(() => error);
      }),
    );
  };
  if (session.accessExpiresAt <= Date.now()) {
    if (session.authState === 'PASSWORD_CHANGE_REQUIRED') {
      auth.expire();
      return throwError(() => new ApplicationError('authentication', 'Sesión finalizada.', 401));
    }
    return from(auth.refresh()).pipe(switchMap(send));
  }
  return send();
};
