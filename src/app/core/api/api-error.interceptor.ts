import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApplicationError, ApplicationErrorKind } from './application-error';

const errorKindByStatus: Record<number, ApplicationErrorKind> = {
  0: 'network',
  400: 'validation',
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

      const body = error.error as {
        detail?: string;
        title?: string;
        code?: string;
        traceId?: string;
      } | null;
      const message = body?.detail ?? body?.title ?? 'The request could not be completed.';
      const kind = errorKindByStatus[error.status] ?? 'unknown';

      const retryAfter = error.headers.get('Retry-After');
      const retryAfterMs =
        retryAfter === null
          ? undefined
          : /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : Math.max(0, Date.parse(retryAfter) - Date.now());
      return throwError(
        () =>
          new ApplicationError(
            kind,
            message,
            error.status,
            body?.code,
            body?.traceId,
            Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
          ),
      );
    }),
  );
