import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { Session } from '../../domain/models/session';
import { AuthenticationGateway, SignInCommand } from '../../domain/ports/authentication.gateway';

@Injectable()
export class HttpAuthenticationAdapter implements AuthenticationGateway {
  private readonly http = inject(HttpClient);

  signIn(command: SignInCommand): Observable<Session> {
    return this.http.post<Session>(`${environment.apiBaseUrl}/auth/login`, {
      loginType: 'MATRICULA',
      loginIdentifier: command.identifier,
      password: command.password,
    });
  }
}
