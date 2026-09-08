import { Injectable, inject } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { SignInCommand } from '../domain/ports/authentication.gateway';
@Injectable({ providedIn: 'root' })
export class SignInUseCase {
  private readonly auth = inject(AuthSessionService);
  execute(command: SignInCommand) {
    return this.auth.login(command);
  }
}
