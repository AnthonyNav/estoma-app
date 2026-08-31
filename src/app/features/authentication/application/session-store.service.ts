import { Injectable, computed, signal } from '@angular/core';

import { Session } from '../domain/models/session';

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  private readonly sessionValue = signal<Session | null>(null);
  readonly session = this.sessionValue.asReadonly();
  readonly accessToken = computed(() => this.sessionValue()?.accessToken ?? null);

  set(session: Session): void {
    this.sessionValue.set(session);
  }
  clear(): void {
    this.sessionValue.set(null);
  }
}
