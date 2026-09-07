import { SupervisorExitService } from '../../wash-exit/application/supervisor-exit.service';
import { ReassignmentWorkflowService } from '../application/reassignment-workflow.service';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, takeUntil } from 'rxjs';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { environment } from '../../../../environments/environment';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { SupervisorHome } from '../domain/models/supervisor-home';

@Component({
  selector: 'app-supervisor-home-page',
  imports: [RouterLink],
  templateUrl: './supervisor-home.page.html',
  styleUrl: './supervisor-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorHomePage {
  private readonly api = inject(WashEntrySupervisionUseCase);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  readonly exits = inject(SupervisorExitService);
  readonly reassignments = inject(ReassignmentWorkflowService);
  readonly flow = inject(SupervisorEntryWorkflowService);
  readonly home = signal<SupervisorHome | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly isDemo = environment.useMockApi;
  readonly metrics = [
    {
      key: 'registeredAppointments',
      label: 'Citas del día',
      tone: 'registered',
      icon: 'M8 3h7l4 4v14H5V3h3Zm6 0v5h5M9 12h6M9 16h6',
    },
    {
      key: 'inProcessAppointments',
      label: 'En proceso',
      tone: 'progress',
      icon: 'M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    },
    {
      key: 'completedAppointments',
      label: 'Finalizadas',
      tone: 'completed',
      icon: 'm8 12 3 3 5-6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    },
    {
      key: 'deniedAppointments',
      label: 'Denegadas',
      tone: 'denied',
      icon: 'm9 9 6 6m0-6-6 6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    },
    {
      key: 'cancelledAppointments',
      label: 'Canceladas',
      tone: 'cancelled',
      icon: 'm6 18 12-12M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    },
  ] as const;
  readonly management = [
    {
      title: 'Gestionar cabinas',
      description: 'Disponibilidad de cabinas y tinas',
      icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
      tone: 'resources',
    },
  ];
  constructor() {
    this.refresh();
    interval(180_000)
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.lifecycle.ended$))
      .subscribe(() => this.refresh());
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .getHome()
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (value) => {
          this.home.set(value);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
  openLookup(): void {
    this.flow.reset();
  }
  dateLabel(value: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(value + 'T12:00:00Z'));
  }
}
