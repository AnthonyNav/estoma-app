import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import { Session } from '../../domain/models/session';
import { AuthenticationGateway, SignInCommand } from '../../domain/ports/authentication.gateway';

@Injectable()
export class MockAuthenticationAdapter implements AuthenticationGateway {
  signIn(command: SignInCommand): Observable<Session> {
    return of<Session>({
      sessionId: 'development-session',
      accountId: command.identifier,
      accessToken: 'development-token-not-for-production',
      refreshToken: 'development-refresh-token-not-for-production',
      authState: 'NORMAL',
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    }).pipe(delay(250));
  }
}
