export type ApplicationErrorKind =
  | 'authentication'
  | 'conflict'
  | 'forbidden'
  | 'network'
  | 'not-found'
  | 'temporary'
  | 'unknown'
  | 'validation';

export class ApplicationError extends Error {
  constructor(
    readonly kind: ApplicationErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly traceId?: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}
