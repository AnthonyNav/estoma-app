import { Injectable, signal } from '@angular/core';
import { Session, SessionProfile, SystemCode } from '../domain/models/session';
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<SessionProfile | null>(null);
  readonly selectedSystemCode = signal<SystemCode>('LAVADO_ULTRASONICO');
  readonly notice = signal<string | null>(null);
  revision = 0;
  // Changes only when a session ends or is replaced, never during token renewal.
  generation = 0;
  clear(message: string | null = null): void {
    this.generation++;
    this.revision++;
    this.session.set(null);
    this.profile.set(null);
    this.notice.set(message);
  }
}
