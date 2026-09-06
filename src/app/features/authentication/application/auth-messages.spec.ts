import { ApplicationError } from '../../../core/api/application-error';
import { ACCESS_DENIED, AUTH_UNAVAILABLE, authMessage } from './auth-messages';

describe('Login public messages', () => {
  it('uses the same message for rejected credentials and denied access', () => {
    for (const status of [400, 401, 403, 409, 422, 429]) {
      expect(authMessage(new ApplicationError('authentication', 'internal detail', status))).toBe(
        ACCESS_DENIED,
      );
    }
  });
  it('uses one temporary failure message for network, server and malformed responses', () => {
    for (const error of [
      new ApplicationError('network', 'offline', 0),
      new ApplicationError('temporary', 'failure', 503),
      new Error('malformed'),
    ]) {
      expect(authMessage(error)).toBe(AUTH_UNAVAILABLE);
      expect(authMessage(error, 'profile')).toBe(AUTH_UNAVAILABLE);
    }
  });
});
