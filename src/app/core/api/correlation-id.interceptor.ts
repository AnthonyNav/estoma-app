import { HttpInterceptorFn } from '@angular/common/http';

const MUTATING_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

export const correlationIdInterceptor: HttpInterceptorFn = (request, next) => {
  let headers = request.headers.set('X-Correlation-Id', crypto.randomUUID());

  if (MUTATING_METHODS.has(request.method) && !headers.has('Idempotency-Key')) {
    headers = headers.set('Idempotency-Key', crypto.randomUUID());
  }

  return next(request.clone({ headers }));
};
