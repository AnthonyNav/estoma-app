import { HttpInterceptorFn } from '@angular/common/http';

// Idempotency belongs to the durable intent and is supplied by each command adapter.
export const correlationIdInterceptor: HttpInterceptorFn = (request, next) =>
  next(request.clone({ setHeaders: { 'X-Correlation-Id': crypto.randomUUID() } }));
