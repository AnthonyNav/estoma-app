import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);

  // The dev nav header is scaffolding for clicking between routes during
  // development, not a designed app chrome — full-screen flows (sign-in)
  // must not have it floating on top.
  readonly hideChrome = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/authentication')),
      startWith(this.router.url.startsWith('/authentication')),
    ),
    { initialValue: this.router.url.startsWith('/authentication') },
  );
}
