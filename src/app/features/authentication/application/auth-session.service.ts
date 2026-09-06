import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationError } from '../../../core/api/application-error';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { AUTHENTICATION_GATEWAY, SignInCommand } from '../domain/ports/authentication.gateway';
import { Session, SessionProfile, SystemCode } from '../domain/models/session';
import { ACCESS_DENIED, AUTH_UNAVAILABLE, authMessage } from './auth-messages';
import { SessionStore } from './session-store.service';
import {
  accessExpiration,
  invalidResponse,
  validateProfile,
  validateSession,
} from './session-validation';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly store = inject(SessionStore);
  private readonly gateway = inject(AUTHENTICATION_GATEWAY);
  private readonly router = inject(Router);
  private readonly lifecycle = inject(SessionLifecycleService);
  private renewal: Promise<Session> | null = null;
  private profileRequest: Promise<SessionProfile> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private loginPending = false;
  private passwordPending = false;

  async login(command: SignInCommand): Promise<Session> {
    if (this.loginPending || !command.identifier.trim() || !command.password)
      throw invalidResponse();
    this.loginPending = true;
    this.reset();
    const revision = this.store.revision;
    try {
      const response = await firstValueFrom(this.gateway.signIn(command));
      if (revision !== this.store.revision) throw invalidResponse();
      const session = validateSession(response);
      this.install(session);
      return session;
    } finally {
      this.loginPending = false;
    }
  }

  async continueAfterLogin(): Promise<void> {
    const generation = this.store.generation;
    if (this.store.session()?.authState === 'PASSWORD_CHANGE_REQUIRED') {
      await this.router.navigate(['/authentication/required-password']);
      return;
    }
    try {
      const profile = await this.loadProfile();
      if (generation !== this.store.generation || !this.store.session()) return;
      const selected = this.store.selectedSystemCode();
      if (profile.availableSystemCodes.includes(selected)) {
        await this.enterSystem(selected);
        return;
      }
    } catch (error) {
      if (generation !== this.store.generation || !this.store.session()) return;
      this.denyAccess(authMessage(error, 'profile'));
      return;
    }
    this.denyAccess();
  }

  async loadProfile(): Promise<SessionProfile> {
    if (this.profileRequest) return this.profileRequest;
    const session = this.store.session();
    if (!session || session.authState !== 'NORMAL') throw invalidResponse();
    const generation = this.store.generation;
    const task = (async () => {
      if (session.accessExpiresAt <= Date.now()) await this.refresh();
      if (generation !== this.store.generation) throw invalidResponse();
      const response = await firstValueFrom(this.gateway.profile());
      if (generation !== this.store.generation) throw invalidResponse();
      const profile = validateProfile(response, session.accountId);
      if (!profile.availableSystemCodes.includes(this.store.selectedSystemCode())) {
        this.denyAccess();
        return profile;
      }
      this.store.profile.set(profile);
      return profile;
    })();
    this.profileRequest = task;
    try {
      return await task;
    } finally {
      if (this.profileRequest === task) this.profileRequest = null;
    }
  }

  refresh(): Promise<Session> {
    if (this.renewal) return this.renewal;
    const session = this.store.session();
    if (!session || session.authState !== 'NORMAL' || !session.refreshToken || this.passwordPending)
      return Promise.reject(invalidResponse());
    const revision = this.store.revision;
    const task = (async () => {
      try {
        const response = await firstValueFrom(
          this.gateway.refresh(session.sessionId, session.refreshToken!),
        );
        if (revision !== this.store.revision) throw invalidResponse();
        if (
          !response ||
          typeof response.accessToken !== 'string' ||
          !response.accessToken ||
          typeof response.refreshToken !== 'string' ||
          !response.refreshToken ||
          !response.expiresAt ||
          !Number.isFinite(Date.parse(response.expiresAt)) ||
          Date.parse(response.expiresAt) <= Date.now()
        )
          throw invalidResponse();
        const next = {
          ...session,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          accessExpiresAt: accessExpiration(response.accessToken),
        };
        this.install(next);
        return next;
      } catch (error) {
        if (revision === this.store.revision) {
          if (error instanceof ApplicationError && error.status === 401) this.expire();
          else {
            this.store.notice.set('No pudimos renovar tu sesión. Verifica tu conexión.');
            this.scheduleRetry();
          }
        }
        throw error;
      }
    })();
    this.renewal = task;
    void task
      .finally(() => {
        if (this.renewal === task) this.renewal = null;
      })
      .catch(() => undefined);
    return task;
  }

  async changeRequiredPassword(newPassword: string): Promise<void> {
    const session = this.store.session();
    if (!session || session.authState !== 'PASSWORD_CHANGE_REQUIRED' || this.passwordPending)
      throw invalidResponse();
    if (session.accessExpiresAt <= Date.now()) {
      this.expire();
      throw invalidResponse();
    }
    this.passwordPending = true;
    const revision = this.store.revision;
    try {
      const response = await firstValueFrom(this.gateway.changePassword(null, newPassword));
      if (revision !== this.store.revision) throw invalidResponse();
      const next = validateSession(response);
      if (
        next.sessionId !== session.sessionId ||
        next.accountId !== session.accountId ||
        next.authState !== 'NORMAL'
      )
        throw invalidResponse();
      this.install(next);
    } finally {
      this.passwordPending = false;
    }
  }

  async enterSystem(code: SystemCode): Promise<void> {
    const profile = this.store.profile();
    if (!profile?.availableSystemCodes.includes(code)) {
      this.denyAccess();
      return;
    }
    this.store.selectedSystemCode.set(code);
    const route =
      code === 'LAVADO_ULTRASONICO'
        ? (
            { ALUMNO: '/wash/student', SUPERVISOR_LAVADO: '/wash/supervision/entry' } as Record<
              string,
              string
            >
          )[profile.roleCode]
        : null;
    await this.router.navigate([route ?? '/authentication/context']);
  }

  logout(): void {
    const accessToken = this.store.session()?.accessToken;
    this.reset();
    const revision = this.store.revision;
    void this.router.navigate(['/authentication/sign-in']);
    if (accessToken)
      void firstValueFrom(this.gateway.logout(accessToken))
        .then((response) => {
          if (response.revoked !== true && this.store.revision === revision)
            this.store.notice.set(AUTH_UNAVAILABLE);
        })
        .catch((error) => {
          if (
            !(error instanceof ApplicationError && error.status === 401) &&
            this.store.revision === revision
          )
            this.store.notice.set(AUTH_UNAVAILABLE);
        });
  }

  private denyAccess(message = ACCESS_DENIED): void {
    const accessToken = this.store.session()?.accessToken;
    this.reset(message);
    void this.router.navigate(['/authentication/sign-in']);
    // Discard the provisional session locally even if remote revocation is unavailable.
    if (accessToken) {
      void firstValueFrom(this.gateway.logout(accessToken)).catch(() => undefined);
    }
  }

  expire(): void {
    this.reset(ACCESS_DENIED);
    void this.router.navigate(['/authentication/sign-in']);
  }

  private reset(message: string | null = null): void {
    clearTimeout(this.expiryTimer);
    this.renewal = null;
    this.profileRequest = null;
    this.store.clear(message);
    this.lifecycle.end();
  }
  private install(session: Session): void {
    this.store.revision++;
    this.store.session.set(session);
    this.store.notice.set(null);
    clearTimeout(this.expiryTimer);
    const restricted = session.authState === 'PASSWORD_CHANGE_REQUIRED';
    this.expiryTimer = setTimeout(
      () => {
        if (restricted) this.expire();
        else void this.refresh().catch(() => undefined);
      },
      Math.max(1000, session.accessExpiresAt - Date.now() - (restricted ? 0 : 30000)),
    );
  }
  private scheduleRetry(): void {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => {
      void this.refresh().catch(() => undefined);
    }, 15000);
  }
}
