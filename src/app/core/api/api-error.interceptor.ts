import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApplicationError, ApplicationErrorKind } from './application-error';

const errorKindByStatus: Record<number, ApplicationErrorKind> = {
  0: 'network',
  401: 'authentication',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'validation',
  503: 'temporary',
};

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const body = error.error as { detail?: string; title?: string } | null;
      const message = body?.detail ?? body?.title ?? 'The request could not be completed.';
      const kind = errorKindByStatus[error.status] ?? 'unknown';

      return throwError(() => new ApplicationError(kind, message, error.status));
    }),
  );
