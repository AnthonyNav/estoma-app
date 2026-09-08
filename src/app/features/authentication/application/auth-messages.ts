import { ApplicationError } from '../../../core/api/application-error';
export const ACCESS_DENIED = 'Acceso denegado';
export const AUTH_UNAVAILABLE = 'No fue posible acceder en este momento. Intenta nuevamente.';

export function authMessage(
  error: unknown,
  context: 'login' | 'profile' | 'password' = 'login',
): string {
  if (context !== 'password') {
    return error instanceof ApplicationError &&
      [400, 401, 403, 409, 422, 429].includes(error.status ?? 0)
      ? ACCESS_DENIED
      : AUTH_UNAVAILABLE;
  }
  if (error instanceof ApplicationError && [400, 409, 422].includes(error.status ?? 0))
    return 'No fue posible cambiar la contraseña. Usa una distinta y evita contraseñas comunes.';
  if (error instanceof ApplicationError && [401, 403].includes(error.status ?? 0))
    return ACCESS_DENIED;
  return AUTH_UNAVAILABLE;
}
