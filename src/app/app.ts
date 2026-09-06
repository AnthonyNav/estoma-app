import { ChangeDetectionStrategy, Component, Injector, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionStore } from './features/authentication/application/session-store.service';
import { AuthSessionService } from './features/authentication/application/auth-session.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  readonly sessionStore = inject(SessionStore);
  logout(): void {
    this.injector.get(AuthSessionService).logout();
  }

  readonly isAuthentication = signal(
    this.router.url.split(/[?#]/)[0].startsWith('/authentication/'),
  );
  showSignOut = signal<boolean>(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;
        this.isAuthentication.set(url.split(/[?#]/)[0].startsWith('/authentication/'));
        const isPublic = url.includes('/authentication') || url.includes('/home');
        this.showSignOut.set(!isPublic);
      });
  }
}
