import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Session } from '../domain/models/session';
import { AUTHENTICATION_GATEWAY, SignInCommand } from '../domain/ports/authentication.gateway';

@Injectable({ providedIn: 'root' })
export class SignInUseCase {
  private readonly gateway = inject(AUTHENTICATION_GATEWAY);

  execute(command: SignInCommand): Observable<Session> {
    return this.gateway.signIn(command);
  }
}
