import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { SupervisorEntryLookup } from '../domain/models/supervisor-entry';

export function matchesStudent(row: SupervisorEntryLookup, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-MX');
  const text = normalize(`${row.student.displayName} ${row.student.studentEnrollment}`);
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((token) => text.includes(token));
}
@Component({
  selector: 'app-supervisor-directory-page',
  imports: [RouterLink],
  templateUrl: './supervisor-directory.page.html',
  styleUrl: './supervisor-directory.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorDirectoryPage {
  private readonly api = inject(WashEntrySupervisionUseCase);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  readonly flow = inject(SupervisorEntryWorkflowService);
  readonly isDemo = environment.useMockApi;
  readonly rows = signal<SupervisorEntryLookup[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly query = signal('');
  readonly filter = signal<'ALL' | 'SCHEDULED' | 'IN_PROGRESS'>('ALL');
  readonly nextOffset = signal<number | null>(null);
  readonly serviceDate = signal('');
  readonly filters = [
    { key: 'ALL', label: 'Todas' },
    { key: 'SCHEDULED', label: 'Registradas' },
    { key: 'IN_PROGRESS', label: 'En proceso' },
  ] as const;
  readonly visible = this.rows;
  readonly day = computed(() => {
    const date = this.serviceDate();
    return date
      ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
          new Date(`${date}T12:00:00Z`),
        )
      : '';
  });
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.rows.set([]);
      this.nextOffset.set(null);
      this.query.set('');
    });
    this.load();
  }
  load(more = false): void {
    if (this.loading()) return;
    const offset = more ? this.nextOffset() : 0;
    if (offset === null) return;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .getDirectory({ query: this.query().trim(), status: this.filter(), offset })
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (page) => {
          const sameDay = this.serviceDate() === page.serviceDate;
          if (more && !sameDay) {
            this.loading.set(false);
            this.load();
            return;
          }
          this.serviceDate.set(page.serviceDate);
          const items = more ? [...this.rows(), ...page.items] : page.items;
          this.rows.set([
            ...new Map(items.map((row) => [row.appointment.appointmentId, row])).values(),
          ]);
          this.nextOffset.set(page.nextOffset);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
  input(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.nextOffset.set(null);
  }
  clear(): void {
    this.query.set('');
    this.filter.set('ALL');
    this.load();
  }
  searchEnrollment(): void {
    const enrollment = this.query().trim();
    if (!enrollment || this.flow.busy() || this.flow.pending()) return;
    this.flow.reset();
    this.flow.search({ lookupType: 'STUDENT_ENROLLMENT', studentEnrollment: enrollment }, () => {
      if (!this.destroyRef.destroyed) void this.router.navigate(['/wash/supervision/entry']);
    });
  }
  select(row: SupervisorEntryLookup): void {
    if (this.flow.busy() || this.flow.pending()) return;
    this.flow.reset();
    this.flow.search(
      {
        lookupType: 'STUDENT_ENROLLMENT',
        studentEnrollment: row.student.studentEnrollment,
      },
      () => {
        if (!this.destroyRef.destroyed) void this.router.navigate(['/wash/supervision/entry']);
      },
    );
  }
  availability(row: SupervisorEntryLookup): string {
    return {
      OPEN: 'Puede ingresar',
      TOO_EARLY: 'Aún no disponible',
      EXPIRED: 'Tolerancia vencida',
      WRONG_DATE: 'Otra fecha',
      SLOT_INACTIVE: 'Turno no activo',
      ALREADY_REGISTERED: 'Llegada registrada',
      NOT_APPLICABLE: 'Atención en curso',
    }[row.arrivalEligibility?.status ?? 'NOT_APPLICABLE'];
  }
  type(row: SupervisorEntryLookup): string {
    return {
      NORMAL: 'Normal',
      JOURNEY: 'Jornada clínica',
      IMMUNOCOMPROMISED: 'Inmunocomprometido',
    }[row.appointment.appointmentType];
  }
  slot(row: SupervisorEntryLookup): string {
    const slot = row.appointment.appointmentTimeSlot;
    const fmt = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: slot.timezone,
    });
    return `${fmt.format(new Date(slot.startsAt))}–${fmt.format(new Date(slot.endsAt))}`;
  }
}
