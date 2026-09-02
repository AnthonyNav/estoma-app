import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);

  // Iniciamos oculto por defecto para evitar cualquier parpadeo al recargar
  showSignOut = signal<boolean>(false);

  constructor() {
    // Escuchamos los cambios de ruta para actualizar la visibilidad en tiempo real
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;
        const isPublic = url.includes('/authentication') || url.includes('/home');
        this.showSignOut.set(!isPublic);
      });
  }
}
