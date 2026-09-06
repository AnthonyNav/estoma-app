import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { LoginResponse, RefreshResponse, SessionProfile } from '../models/session';
export interface SignInCommand {
  identifier: string;
  password: string;
}
export interface AuthenticationGateway {
  signIn(command: SignInCommand): Observable<LoginResponse>;
  profile(): Observable<SessionProfile>;
  refresh(sessionId: string, refreshToken: string): Observable<RefreshResponse>;
  changePassword(currentPassword: string | null, newPassword: string): Observable<LoginResponse>;
  logout(accessToken: string): Observable<{ revoked: boolean }>;
}
export const AUTHENTICATION_GATEWAY = new InjectionToken<AuthenticationGateway>(
  'AUTHENTICATION_GATEWAY',
);
