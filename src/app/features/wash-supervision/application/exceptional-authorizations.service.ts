import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, takeUntil, timeout } from 'rxjs';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../wash-appointments/domain/models/appointment-registration';
import {
  validateAccepted,
  validateOperation,
} from '../../wash-appointments/infrastructure/api/booking-validation';
import {
  validateStudents,
  validateAuthorizations,
} from '../infrastructure/api/exceptional-authorization-validation';
import { environment } from '../../../../environments/environment';
import { ApplicationError } from '../../../core/api/application-error';
import {
  OperationTrackerService,
  OperationStatus,
} from '../../../core/api/operation-tracker.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SessionStore } from '../../authentication/application/session-store.service';

export interface AuthorizationStudent {
  accountId: string;
  enrollment: string;
  fullName: string;
}
export interface ExceptionalAuthorization {
  authorizationId: string;
  status: string;
  reason: string | null;
  canCancel: boolean;
}
interface Receipt {
  path: string;
  body: { reason: string; studentAccountId?: string; serviceDate?: string };
  key: string;
  operationId?: string;
  attempted?: boolean;
  status?: OperationStatus;
}

@Injectable({ providedIn: 'root' })
export class ExceptionalAuthorizationsService {
  private readonly http = inject(HttpClient);
  private readonly tracker = inject(OperationTrackerService);
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly base = `${environment.apiBaseUrl}/wash/exceptional-authorizations`;
  private readonly storageKey = 'estoma.exceptional-authorizations.receipts.v1';
  private readonly receipts = signal(this.restore());
  readonly pending = computed(
    () => this.receipts().get(this.session.session()?.accountId ?? '') ?? null,
  );
  readonly busy = signal(false);
  readonly message = signal('');
  readonly settled = signal(0);

  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.busy.set(false);
      this.message.set('');
    });
  }
  search(query: string) {
    return this.http
      .get<AuthorizationStudent[]>(`${this.base}/students`, { params: { query } })
      .pipe(timeout(15000), map(validateStudents), takeUntil(this.lifecycle.ended$));
  }
  list(studentAccountId: string, serviceDate: string) {
    return this.http
      .get<ExceptionalAuthorization[]>(this.base, {
        params: { studentAccountId, serviceDate },
      })
      .pipe(timeout(15000), map(validateAuthorizations), takeUntil(this.lifecycle.ended$));
  }
  grant(studentAccountId: string, serviceDate: string, reason: string): void {
    this.start({
      path: '',
      body: { studentAccountId, serviceDate, reason },
      key: crypto.randomUUID(),
    });
  }
  cancel(id: string, reason: string): void {
    this.start({
      path: `/${encodeURIComponent(id)}/cancel`,
      body: { reason },
      key: crypto.randomUUID(),
    });
  }
  private start(receipt: Receipt): void {
    const owner = this.session.session()?.accountId;
    if (environment.useMockApi || !owner || this.pending() || this.busy()) return;
    if (this.save(owner, receipt)) this.resume();
  }
  resume(): void {
    const receipt = this.pending();
    const owner = this.session.session()?.accountId;
    if (
      !owner ||
      !receipt ||
      this.busy() ||
      receipt.status === 'SUCCEEDED' ||
      receipt.status === 'REJECTED'
    )
      return;
    this.busy.set(true);
    this.message.set('');
    if (receipt.operationId) {
      this.poll(owner, receipt);
      return;
    }
    if (!this.save(owner, { ...receipt, attempted: true })) {
      this.busy.set(false);
      return;
    }
    // The persisted payload and key are reused even if the initial response was lost.
    this.http
      .post<AcceptedOperation>(`${this.base}${receipt.path}`, receipt.body, {
        headers: { 'Idempotency-Key': receipt.key },
      })
      .pipe(timeout(15000), map(validateAccepted), takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (accepted) => {
          const next = { ...receipt, operationId: accepted.operationId };
          this.save(owner, next);
          this.poll(owner, next);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          if (
            !receipt.attempted &&
            error instanceof ApplicationError &&
            [400, 403, 422].includes(error.status ?? 0)
          ) {
            this.save(owner, { ...receipt, attempted: true, status: 'REJECTED' });
            this.message.set(
              'La solicitud fue rechazada. Revisa los datos y tu acceso antes de continuar.',
            );
            return;
          }
          this.message.set(
            'No pudimos confirmar la recepción. Consulta nuevamente la misma solicitud.',
          );
        },
      });
  }
  private poll(owner: string, receipt: Receipt): void {
    this.tracker
      .trackWith(
        () =>
          this.http
            .get<DurableOperation>(
              `${environment.apiBaseUrl}/operations/${encodeURIComponent(receipt.operationId!)}`,
            )
            .pipe(
              timeout(15000),
              map((value) => validateOperation(value, receipt.operationId!)),
            ),
        { maxPendingPolls: 45 },
      )
      .pipe(takeUntil(this.lifecycle.ended$))
      .subscribe({
        next: (result) => {
          if (result.status === 'PENDING') return;
          this.busy.set(false);
          this.save(owner, { ...receipt, status: result.status });
          this.message.set(
            result.status === 'SUCCEEDED'
              ? 'Solicitud completada. Actualiza la consulta para ver el estado.'
              : result.status === 'REJECTED'
                ? 'Solicitud rechazada. Revisa el estado del alumno y de sus autorizaciones.'
                : 'Resultado no confirmado. Conserva la referencia y consulta nuevamente antes de otra acción.',
          );
          this.settled.update((value) => value + 1);
        },
        error: () => {
          this.busy.set(false);
          this.message.set(
            'La comprobación sigue pendiente. Puedes retomarla sin duplicar la solicitud.',
          );
        },
      });
  }
  acknowledge(): void {
    const receipt = this.pending();
    const owner = this.session.session()?.accountId;
    if (!owner || !receipt || !['SUCCEEDED', 'REJECTED'].includes(receipt.status ?? '')) return;
    const next = new Map(this.receipts());
    next.delete(owner);
    this.persist(next);
  }
  private restore(): Map<string, Receipt> {
    try {
      return new Map(JSON.parse(localStorage.getItem(this.storageKey) ?? '[]'));
    } catch {
      return new Map();
    }
  }
  private save(owner: string, receipt: Receipt): boolean {
    return this.persist(new Map(this.receipts()).set(owner, receipt));
  }
  private persist(next: Map<string, Receipt>): boolean {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...next]));
      this.receipts.set(next);
      return true;
    } catch {
      if (this.pending()) this.receipts.set(next);
      this.message.set(
        'No pudimos guardar el seguimiento. Habilita el almacenamiento del navegador.',
      );
      return false;
    }
  }
}
