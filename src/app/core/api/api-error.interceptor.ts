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

      const body = error.error as { code?: string; title?: string } | null;
      const message = messageFor(error.status, body?.code, body?.title);
      const kind = errorKindByStatus[error.status] ?? 'unknown';

      return throwError(() => new ApplicationError(kind, message, error.status, body?.code));
    }),
  );

function messageFor(status: number, code?: string, title?: string): string {
  const messageByStatus: Partial<Record<number, string>> = {
    0: 'No fue posible conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
    401: 'Tu sesión ya no es válida. Inicia sesión nuevamente.',
    403: 'No tienes autorización para realizar esta acción.',
    404: 'No encontramos la información solicitada.',
    409: 'La información cambió mientras la consultabas. Actualízala e inténtalo de nuevo.',
    422: 'Revisa los datos capturados e inténtalo de nuevo.',
    503: 'La información no está disponible de forma confiable en este momento. Inténtalo más tarde.',
  };

  return (
    messageByStatus[status] ??
    (code
      ? `No fue posible completar la operación (${code}).`
      : (title ?? 'No fue posible completar la operación.'))
  );
}
