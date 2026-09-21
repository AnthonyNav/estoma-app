import {
  ApplicationRef,
  DestroyRef,
  Injectable,
  InjectionToken,
  NgZone,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { BUILD_COMMIT } from '../../../build-version';
import { UpdateSafetyService } from './update-safety.service';

export const RELOAD_APP = new InjectionToken<() => void>('Reload application', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});
export const APP_STABLE = new InjectionToken('Application stability', {
  providedIn: 'root',
  factory: () => inject(ApplicationRef).isStable,
});

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly safety = inject(UpdateSafetyService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = inject(RELOAD_APP);
  readonly version = BUILD_COMMIT.slice(0, 7);
  readonly enabled = this.sw?.isEnabled ?? false;
  readonly ready = signal(false);
  readonly broken = signal(false);
  readonly checking = signal(false);
  readonly reloading = signal(false);
  readonly message = signal('');
  readonly blockedReason = signal<string | null>(null);
  private lastCheck = 0;
  private nextHash: string | null = null;

  constructor() {
    if (!this.sw?.isEnabled) return;
    this.sw.versionUpdates.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.nextHash = event.latestVersion.hash;
        this.ready.set(true);
        this.message.set('La nueva versión está lista. Tus solicitudes guardadas se conservan.');
        this.refreshSafety();
        this.autoUpdateAtLogin();
      } else if (event.type === 'NO_NEW_VERSION_DETECTED') {
        // Another tab may have installed the version before this client subscribed.
        // The worker reports the latest installed manifest, not this running bundle.
        const commit = (event.version.appData as { commit?: unknown } | undefined)?.commit;
        if (typeof commit === 'string' && commit !== BUILD_COMMIT) {
          this.nextHash = event.version.hash;
          this.ready.set(true);
          this.message.set('La nueva versión está lista. Tus solicitudes guardadas se conservan.');
          this.refreshSafety();
          this.autoUpdateAtLogin();
        } else if (!this.ready()) {
          this.message.set(
            commit === BUILD_COMMIT
              ? 'Ya tienes la versión disponible.'
              : 'Comprobación terminada.',
          );
        }
      } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
        this.message.set('No se pudo preparar la actualización. Puedes volver a comprobarla.');
      }
    });
    this.sw.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => {
      this.broken.set(true);
      this.ready.set(true);
      this.message.set(
        'Esta versión necesita recargarse. Conservaremos las solicitudes guardadas.',
      );
      this.refreshSafety();
    });
    inject(APP_STABLE)
      .pipe(filter(Boolean), take(1), takeUntilDestroyed())
      .subscribe(() => {
        void this.check();
        this.zone.runOutsideAngular(() => {
          const interval = window.setInterval(
            () => void this.zone.run(() => this.check()),
            5 * 60_000,
          );
          const safetyInterval = window.setInterval(() => {
            if (this.ready()) this.zone.run(() => this.refreshSafety());
          }, 1000);
          const wake = () => {
            if (document.visibilityState === 'visible') void this.zone.run(() => this.check());
          };
          window.addEventListener('focus', wake);
          window.addEventListener('online', wake);
          document.addEventListener('visibilitychange', wake);
          this.destroy.onDestroy(() => {
            clearInterval(interval);
            clearInterval(safetyInterval);
            window.removeEventListener('focus', wake);
            window.removeEventListener('online', wake);
            document.removeEventListener('visibilitychange', wake);
          });
        });
      });
  }

  refreshSafety(): void {
    this.blockedReason.set(this.safety.reason());
  }

  async check(manual = false): Promise<void> {
    if (!this.sw?.isEnabled || this.checking() || this.reloading()) return;
    if (!manual && Date.now() - this.lastCheck < 30_000) return;
    this.lastCheck = Date.now();
    this.checking.set(true);
    try {
      // false can also mean a failed download/offline. Events carry the actual outcome.
      await this.sw.checkForUpdate();
    } catch {
      this.message.set(
        'No pudimos comprobar actualizaciones. Lo intentaremos al recuperar la conexión.',
      );
    } finally {
      this.checking.set(false);
    }
  }

  private autoUpdateAtLogin(): void {
    if (this.broken() || this.router.url.split(/[?#]/)[0] !== '/authentication/sign-in') return;
    // One automatic reload per downloaded version per tab; never erase durable storage.
    try {
      if (!this.nextHash || sessionStorage.getItem('estoma.update.auto') === this.nextHash) return;
      if (this.safety.reason()) return;
      sessionStorage.setItem('estoma.update.auto', this.nextHash);
      this.apply();
    } catch {
      /* Storage unavailable: keep the explicit update prompt. */
    }
  }

  apply(): void {
    if (!this.ready() || this.reloading()) return;
    this.refreshSafety();
    if (this.blockedReason()) return;
    this.reloading.set(true);
    // Reload the entire version; activateUpdate() alone can mix lazy chunks across releases.
    this.reload();
  }
}
