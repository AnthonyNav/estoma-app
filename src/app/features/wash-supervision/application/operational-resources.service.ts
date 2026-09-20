import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, takeUntil, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import {
  validateAccepted,
  validateOperation,
} from '../../wash-appointments/infrastructure/api/booking-validation';
import { AcceptedOperation, DurableOperation } from '../domain/models/supervisor-entry';
import { map } from 'rxjs';

export interface ResourceUnavailability {
  resourceUnavailabilityId: string;
  reason: string;
  expectedVersion: number;
}
export interface OperationalResource {
  resourceId: string;
  resourceType: 'CABIN' | 'TANK';
  code: string;
  name: string;
  administrativeStatus: string;
  unavailabilities: ResourceUnavailability[];
}
interface Receipt {
  action: 'disable' | 'restore';
  key: string;
  label: string;
  resourceId: string;
  body: Record<string, string | number>;
  operationId?: string;
}
const STORAGE = 'estoma.operational-resources.receipts.v1';
@Injectable({ providedIn: 'root' })
export class OperationalResourcesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly tracker = inject(OperationTrackerService);
  private readonly receipts = signal<Record<string, Receipt>>(this.restore());
  private epoch = 0;
  readonly resources = signal<OperationalResource[]>([]);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly message = signal('');
  readonly pending = computed(
    () => this.receipts()[this.session.session()?.accountId ?? ''] ?? null,
  );
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.epoch++;
      this.resources.set([]);
      this.loaded.set(false);
      this.busy.set(false);
      this.message.set('');
    });
  }
  private restore(): Record<string, Receipt> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
    } catch {
      return {};
    }
  }
  private save(receipt: Receipt | null): boolean {
    const owner = this.session.session()?.accountId;
    if (!owner) return false;
    const next = { ...this.receipts() };
    if (receipt) next[owner] = receipt;
    else delete next[owner];
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      this.message.set('Habilita el almacenamiento del navegador para conservar el seguimiento.');
      return false;
    }
    this.receipts.set(next);
    return true;
  }
  async load(): Promise<void> {
    const epoch = this.epoch;
    this.loaded.set(false);
    this.resources.set([]);
    try {
      const result = await firstValueFrom(
        this.http
          .get<{
            resources: OperationalResource[];
          }>(`${environment.apiBaseUrl}/wash/operational-resources`)
          .pipe(timeout(15000), takeUntil(this.lifecycle.ended$)),
      );
      if (epoch !== this.epoch) return;
      if (
        !Array.isArray(result.resources) ||
        result.resources.some(
          (r) =>
            !r.resourceId ||
            !r.code ||
            !r.name ||
            !['CABIN', 'TANK'].includes(r.resourceType) ||
            !r.administrativeStatus ||
            !Array.isArray(r.unavailabilities) ||
            r.unavailabilities.some(
              (u) =>
                !u.resourceUnavailabilityId ||
                !u.reason ||
                !Number.isSafeInteger(u.expectedVersion) ||
                u.expectedVersion <= 0,
            ),
        )
      )
        throw new Error('Incomplete projection');
      this.resources.set(result.resources);
      this.loaded.set(true);
    } catch {
      if (epoch === this.epoch)
        this.message.set('No pudimos consultar los recursos. Actualiza para continuar.');
    }
  }
  start(resource: OperationalResource, reason: string, unavailable?: ResourceUnavailability): void {
    const trimmed = reason.trim();
    if (
      this.pending() ||
      this.busy() ||
      !this.loaded() ||
      !this.resources().includes(resource) ||
      !trimmed ||
      trimmed.length > 500 ||
      (unavailable && !resource.unavailabilities.includes(unavailable)) ||
      (!unavailable &&
        (resource.administrativeStatus !== 'ACTIVE' || resource.unavailabilities.length > 0))
    )
      return;
    const body: Record<string, string | number> = unavailable
      ? {
          resourceUnavailabilityId: unavailable.resourceUnavailabilityId,
          expectedVersion: unavailable.expectedVersion,
          resolution: trimmed,
        }
      : {
          [resource.resourceType === 'CABIN' ? 'cabinId' : 'tankId']: resource.resourceId,
          causeType: 'MANUAL_DISABLE',
          reason: trimmed,
        };
    if (
      this.save({
        action: unavailable ? 'restore' : 'disable',
        body,
        key: crypto.randomUUID(),
        label: resource.name,
        resourceId: resource.resourceId,
      })
    )
      void this.resume();
  }
  async resume(): Promise<void> {
    let receipt = this.pending();
    if (!receipt || this.busy()) return;
    const epoch = this.epoch;
    this.busy.set(true);
    this.message.set('');
    try {
      if (!receipt.operationId) {
        const accepted = await firstValueFrom(
          this.http
            .post<AcceptedOperation>(
              `${environment.apiBaseUrl}/wash/operational-resources/${receipt.action}`,
              receipt.body,
              { headers: { 'Idempotency-Key': receipt.key } },
            )
            .pipe(timeout(15000), map(validateAccepted), takeUntil(this.lifecycle.ended$)),
        );
        if (epoch !== this.epoch) return;
        receipt = { ...receipt, operationId: accepted.operationId };
        if (!this.save(receipt)) return;
      }
      const id = receipt.operationId!;
      const result = await firstValueFrom(
        this.tracker
          .trackWith(
            () =>
              this.http
                .get<DurableOperation>(
                  `${environment.apiBaseUrl}/operations/${encodeURIComponent(id)}`,
                )
                .pipe(
                  timeout(15000),
                  map((value) => validateOperation(value, id)),
                ),
            { maxPendingPolls: 30 },
          )
          .pipe(
            filter((value) => value.status !== 'PENDING'),
            takeUntil(this.lifecycle.ended$),
          ),
      );
      if (epoch !== this.epoch) return;
      if (result.status === 'SUCCEEDED' || result.status === 'REJECTED') {
        await this.load();
        if (epoch !== this.epoch) return;
        const resource = this.resources().find((r) => r.resourceId === receipt!.resourceId);
        const projected =
          !!resource &&
          (receipt.action === 'restore'
            ? !resource.unavailabilities.some(
                (u) => u.resourceUnavailabilityId === receipt!.body['resourceUnavailabilityId'],
              )
            : resource.unavailabilities.some(
                (u) =>
                  u.resourceUnavailabilityId ===
                  (result.data as { resourceUnavailabilityId?: string } | null)
                    ?.resourceUnavailabilityId,
              ));
        if (result.status === 'SUCCEEDED' && (!this.loaded() || !projected)) {
          this.message.set(
            'Cambio confirmado; esperamos la actualización de los recursos. Consulta de nuevo.',
          );
          return;
        }
        if (!this.save(null)) return;
        this.message.set(
          result.status === 'SUCCEEDED'
            ? 'Cambio confirmado. Los datos pueden tardar en actualizarse.'
            : 'El cambio fue rechazado. Revisa el estado actualizado antes de intentar de nuevo.',
        );
      } else
        this.message.set(
          'Resultado sin confirmar. Conservamos la solicitud para consultar de nuevo.',
        );
    } catch {
      if (epoch === this.epoch)
        this.message.set(
          'No pudimos confirmar el resultado. Consulta de nuevo con la misma referencia.',
        );
    } finally {
      if (epoch === this.epoch) this.busy.set(false);
    }
  }
}
