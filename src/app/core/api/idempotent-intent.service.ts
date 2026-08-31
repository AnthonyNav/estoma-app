import { Injectable } from '@angular/core';

/** Conserva la clave de una intención hasta conocer un resultado terminal. */
@Injectable({ providedIn: 'root' })
export class IdempotentIntentService {
  private readonly keys = new Map<string, string>();

  key(intent: string): string {
    const existing = this.keys.get(intent);
    if (existing) {
      return existing;
    }

    const value =
      globalThis.crypto?.randomUUID?.() ??
      `idempotency-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.keys.set(intent, value);
    return value;
  }

  complete(intent: string): void {
    this.keys.delete(intent);
  }
}
