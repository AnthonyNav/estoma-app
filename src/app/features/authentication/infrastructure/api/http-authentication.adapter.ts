import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { LoginResponse, RefreshResponse, SessionProfile } from '../../domain/models/session';
import { AuthenticationGateway, SignInCommand } from '../../domain/ports/authentication.gateway';

export function loginPayload(command: SignInCommand) {
  const loginIdentifier = command.identifier.trim();
  return {
    loginType: /^[0-9]+$/.test(loginIdentifier) ? 'MATRICULA' : 'USERNAME',
    loginIdentifier,
    password: command.password,
  };
}
@Injectable()
export class HttpAuthenticationAdapter implements AuthenticationGateway {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  signIn(command: SignInCommand): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, loginPayload(command))
      .pipe(timeout(15000));
  }
  profile(): Observable<SessionProfile> {
    return this.http.get<SessionProfile>(`${this.base}/me`).pipe(timeout(15000));
  }
  refresh(sessionId: string, refreshToken: string): Observable<RefreshResponse> {
    return this.http
      .post<RefreshResponse>(`${this.base}/auth/refresh`, { sessionId, refreshToken })
      .pipe(timeout(15000));
  }
  changePassword(currentPassword: string | null, newPassword: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/me/password`, { currentPassword, newPassword })
      .pipe(timeout(15000));
  }
  logout(accessToken: string): Observable<{ revoked: boolean }> {
    return this.http
      .post<{
        revoked: boolean;
      }>(`${this.base}/auth/logout`, null, { headers: { Authorization: `Bearer ${accessToken}` } })
      .pipe(timeout(15000));
  }
}
