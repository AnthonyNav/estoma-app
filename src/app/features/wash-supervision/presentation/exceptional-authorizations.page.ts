import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntil } from 'rxjs';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { environment } from '../../../../environments/environment';
import {
  AuthorizationStudent,
  ExceptionalAuthorization,
  ExceptionalAuthorizationsService,
} from '../application/exceptional-authorizations.service';

@Component({
  selector: 'app-exceptional-authorizations',
  imports: [FormsModule, RouterLink],
  templateUrl: './exceptional-authorizations.page.html',
  styleUrl: './exceptional-authorizations.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExceptionalAuthorizationsPage {
  readonly flow = inject(ExceptionalAuthorizationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lifecycle = inject(SessionLifecycleService);
  readonly demo = environment.useMockApi;
  readonly students = signal<AuthorizationStudent[]>([]);
  readonly selected = signal<AuthorizationStudent | null>(null);
  readonly authorizations = signal<ExceptionalAuthorization[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  query = '';
  date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  reason = '';
  cancellationReason = '';
  readonly labels: Record<string, string | undefined> = {
    AVAILABLE: 'Disponible',
    CANCELLED: 'Cancelada',
    CONSUMED: 'Utilizada',
    SUPERSEDED: 'Reemplazada por una autorización posterior',
    EXPIRED: 'Vigencia concluida',
    UNKNOWN: 'Estado pendiente de verificar',
  };
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.students.set([]);
      this.selected.set(null);
      this.authorizations.set([]);
      this.loading.set(false);
      this.loaded.set(false);
      this.error.set('');
      this.query = '';
      this.reason = '';
      this.cancellationReason = '';
    });
  }
  search(): void {
    if (this.demo || this.loading() || this.query.trim().length < 2) return;
    this.selected.set(null);
    this.loaded.set(false);
    this.students.set([]);
    this.loading.set(true);
    this.error.set('');
    this.flow
      .search(this.query.trim())
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (students) => {
          this.students.set(students);
          this.loading.set(false);
          if (!students.length) this.error.set('No se encontraron alumnos activos.');
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No pudimos consultar los alumnos. Intenta nuevamente.');
        },
      });
  }
  select(student: AuthorizationStudent): void {
    this.selected.set(student);
    this.refresh();
  }
  refresh(): void {
    const student = this.selected();
    this.loaded.set(false);
    this.authorizations.set([]);
    if (!student || !/^\d{4}-\d{2}-\d{2}$/.test(this.date) || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.flow
      .list(student.accountId, this.date)
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (items) => {
          this.authorizations.set(items);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No pudimos verificar las autorizaciones. Actualiza la consulta.');
        },
      });
  }
  grant(): void {
    const student = this.selected();
    if (!student || !this.loaded() || !this.reason.trim() || this.flow.pending()) return;
    this.flow.grant(student.accountId, this.date, this.reason.trim());
  }
  cancel(item: ExceptionalAuthorization): void {
    if (!item.canCancel || !this.cancellationReason.trim() || this.flow.pending()) return;
    this.flow.cancel(item.authorizationId, this.cancellationReason.trim());
  }
  acknowledge(): void {
    this.flow.acknowledge();
    this.reason = '';
    this.cancellationReason = '';
    this.refresh();
  }
}
