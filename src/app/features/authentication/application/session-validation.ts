import { ApplicationError } from '../../../core/api/application-error';
import { LoginResponse, Session, SessionProfile } from '../domain/models/session';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invalidResponse(): ApplicationError {
  return new ApplicationError(
    'temporary',
    'No pudimos validar la respuesta del servicio. Intenta nuevamente.',
  );
}
// exp schedules renewal only. Token authenticity and permissions are validated by the BFF.
export function accessExpiration(token: string): number {
  try {
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(segment));
    const exp = (payload as { exp?: unknown })?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp * 1000 <= Date.now())
      throw invalidResponse();
    return exp * 1000;
  } catch {
    throw invalidResponse();
  }
}
export function validateSession(value: LoginResponse): Session {
  if (
    !value ||
    !value.accountId ||
    !uuid.test(value.accountId) ||
    !value.sessionId ||
    !uuid.test(value.sessionId) ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken ||
    !['NORMAL', 'PASSWORD_CHANGE_REQUIRED'].includes(value.authState ?? '') ||
    (value.authState === 'NORMAL' &&
      (typeof value.refreshToken !== 'string' || !value.refreshToken)) ||
    (value.authState === 'PASSWORD_CHANGE_REQUIRED' && value.refreshToken != null)
  )
    throw invalidResponse();
  return {
    accountId: value.accountId,
    sessionId: value.sessionId,
    accessToken: value.accessToken,
    refreshToken: value.refreshToken ?? null,
    authState: value.authState as Session['authState'],
    accessExpiresAt: accessExpiration(value.accessToken),
  };
}
export function validateProfile(value: SessionProfile, accountId: string): SessionProfile {
  const strings = [
    'accountId',
    'personId',
    'displayName',
    'loginType',
    'loginIdentifier',
    'institutionalEmail',
    'roleCode',
  ] as const;
  if (
    !value ||
    strings.some((key) => typeof value[key] !== 'string') ||
    value.accountId !== accountId ||
    !uuid.test(value.personId) ||
    !Array.isArray(value.availableSystemCodes) ||
    value.availableSystemCodes.some((code) => typeof code !== 'string')
  )
    throw invalidResponse();
  return value;
}
