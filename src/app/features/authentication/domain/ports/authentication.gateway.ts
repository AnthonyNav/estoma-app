import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Session } from '../models/session';

export interface SignInCommand {
  identifier: string;
  password: string;
}

export interface AuthenticationGateway {
  signIn(command: SignInCommand): Observable<Session>;
}

export const AUTHENTICATION_GATEWAY = new InjectionToken<AuthenticationGateway>(
  'AUTHENTICATION_GATEWAY',
);
