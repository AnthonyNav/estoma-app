import { ApplicationError } from './application-error';

export type DurableOperationStatus = 'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'EXPIRED';

export interface AcceptedOperation {
  operationId: string;
  status: DurableOperationStatus;
  pollPath: string;
  submittedAt: string;
}

export interface DurableOperation {
  operationId: string;
  status: DurableOperationStatus;
  errorCode?: string | null;
  data?: Record<string, unknown> | null;
}

const STATUSES: readonly DurableOperationStatus[] = [
  'PENDING',
  'SUCCEEDED',
  'REJECTED',
  'FAILED',
  'EXPIRED',
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidOperationResponse(): never {
  throw new ApplicationError(
    'temporary',
    'No pudimos validar la información recibida. Intenta nuevamente.',
  );
}

export function validateAccepted(value: AcceptedOperation): AcceptedOperation {
  if (
    !value ||
    !uuidPattern.test(value.operationId) ||
    !STATUSES.includes(value.status) ||
    value.pollPath !== `/api/v1/operations/${value.operationId}` ||
    !Number.isFinite(Date.parse(value.submittedAt))
  )
    return invalidOperationResponse();
  return value;
}

export function validateOperation(value: DurableOperation, operationId: string): DurableOperation {
  if (!value || value.operationId !== operationId || !STATUSES.includes(value.status))
    return invalidOperationResponse();
  if (value.errorCode != null && typeof value.errorCode !== 'string')
    return invalidOperationResponse();
  return value;
}

export function rejectionMessage(operation: DurableOperation): string {
  if (operation.status === 'FAILED') {
    return 'Ocurrió un error inesperado al procesar la solicitud. Intenta nuevamente.';
  }
  return operation.errorCode
    ? `La solicitud fue rechazada (${operation.errorCode}).`
    : 'La solicitud fue rechazada.';
}
