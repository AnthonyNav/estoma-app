import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { SupervisorHome } from '../domain/models/supervisor-entry';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';

@Component({
  selector: 'app-wash-supervisor-home-page',
  imports: [RouterLink],
  templateUrl: './wash-supervisor-home.page.html',
  styleUrl: './wash-supervisor-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashSupervisorHomePage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly supervision = inject(WashEntrySupervisionUseCase);

  readonly home = signal<SupervisorHome | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.supervision
      .loadHome()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible cargar la operación de hoy.',
          );
          this.loading.set(false);
        },
      });
  }
}
