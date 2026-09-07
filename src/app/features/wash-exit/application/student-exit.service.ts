import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, Observable, take, switchMap, takeUntil, timer } from 'rxjs';
import {
  STUDENT_EXIT_GATEWAY,
  StudentExitCommand,
  validMaterials,
  ExitMaterials,
} from '../domain/student-exit';
import { STUDENT_WASH_HOME_GATEWAY } from '../../wash-student-home/domain/ports/student-wash-home.gateway';
import { StudentWashHome } from '../../wash-student-home/domain/models/student-wash-home';
import { DurableOperation } from '../../wash-appointments/domain/models/appointment-registration';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ApplicationError } from '../../../core/api/application-error';
interface Receipt {
  command: StudentExitCommand;
  appointmentId: string;
  operationId?: string;
  pollPath?: string;
  result?: DurableOperation;
}
@Injectable({ providedIn: 'root' })
export class StudentExitService {
  private readonly api = inject(STUDENT_EXIT_GATEWAY);
  private readonly homes = inject(STUDENT_WASH_HOME_GATEWAY);
  private readonly session = inject(SessionStore);
  private readonly lifecycle = inject(SessionLifecycleService);
  private readonly tracker = inject(OperationTrackerService);
  private readonly receipts = signal<Record<string, Receipt>>(this.restore());
  private epoch = 0;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly settled = signal<StudentWashHome | null>(null);
  readonly pending = computed(
    () => this.receipts()[this.session.session()?.accountId ?? ''] ?? null,
  );
  constructor() {
    this.lifecycle.ended$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.epoch++;
      this.busy.set(false);
      this.error.set(null);
      this.settled.set(null);
    });
  }
  private restore(): Record<string, Receipt> {
    try {
      return JSON.parse(sessionStorage.getItem('estoma.student-exit.receipts.v1') ?? '{}');
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
      sessionStorage.setItem('estoma.student-exit.receipts.v1', JSON.stringify(next));
    } catch {
      if (this.pending()) this.receipts.set(next);
      this.error.set(
        'No pudimos guardar el seguimiento. Habilita el almacenamiento del navegador antes de enviar.',
      );
      return false;
    }
    this.receipts.set(next);
    return true;
  }
  start(home: StudentWashHome, materials: ExitMaterials): void {
    const appointment = home.appointment,
      execution = appointment?.washExecution;
    const version = execution?.executionVersion ?? execution?.version;
    if (
      this.pending() ||
      this.busy() ||
      !appointment ||
      execution?.status !== 'IN_PROGRESS' ||
      !Number.isInteger(version) ||
      !version ||
      !validMaterials(materials)
    )
      return;
    this.error.set(null);
    this.settled.set(null);
    if (
      this.save({
        appointmentId: appointment.appointmentId,
        command: {
          washExecutionId: execution.washExecutionId,
          expectedVersion: version,
          materials: structuredClone(materials),
          idempotencyKey: crypto.randomUUID(),
        },
      })
    )
      void this.resume();
  }
  private read<T>(source: Observable<T>) {
    return firstValueFrom(source.pipe(takeUntil(this.lifecycle.ended$)));
  }
  async resume(): Promise<void> {
    let receipt = this.pending();
    if (!receipt || this.busy()) return;
    const epoch = this.epoch;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (!receipt.operationId) {
        const accepted = await this.read(this.api.submit(receipt.command));
        if (epoch !== this.epoch) return;
        receipt = { ...receipt, operationId: accepted.operationId, pollPath: accepted.pollPath };
        this.save(receipt);
      }
      if (!receipt.result) {
        const id = receipt.operationId!;
        const result = await this.read(
          this.tracker
            .trackWith(
              () =>
                timer(0, 1000).pipe(
                  filter(() => document.visibilityState !== 'hidden'),
                  take(1),
                  switchMap(() => this.api.operation(id)),
                ),
              { intervalMs: 1500, maxPendingPolls: 35 },
            )
            .pipe(filter((r) => r.status !== 'PENDING')),
        );
        if (epoch !== this.epoch) return;
        receipt = { ...receipt, result };
        this.save(receipt);
      }
      if (receipt.result!.status === 'REJECTED') {
        const code = receipt.result!.errorCode;
        this.save(null);
        this.error.set(
          code === 'VERSION_CONFLICT' || code === 'INVALID_WASH_EXECUTION_STATUS'
            ? 'Tu atención cambió. Actualiza tu cita antes de revisar y enviar de nuevo.'
            : 'No se pudo registrar tu salida. Actualiza tu cita y revisa los datos.',
        );
        return;
      }
      if (receipt.result!.status !== 'SUCCEEDED') {
        this.error.set(
          'El resultado no es concluyente. Conservamos tu solicitud; pide apoyo al supervisor antes de realizar otro envío.',
        );
        return;
      }
      for (let attempt = 0; attempt < 15; attempt++) {
        const home = await this.read(this.homes.loadHome());
        if (epoch !== this.epoch) return;
        const appointment = home.appointment,
          execution = appointment?.washExecution;
        if (
          appointment?.appointmentId === receipt.appointmentId &&
          execution?.washExecutionId === receipt.command.washExecutionId &&
          (execution.executionVersion ?? execution.version ?? 0) >
            receipt.command.expectedVersion &&
          ['EXIT_SUBMITTED', 'COMPLETED'].includes(execution.status) &&
          validMaterials(execution.submittedExitMaterials) &&
          Object.entries(receipt.command.materials).every(
            ([key, value]) =>
              execution.submittedExitMaterials![key as keyof ExitMaterials] === value,
          )
        ) {
          if (this.save(null)) this.settled.set(home);
          return;
        }
        await this.read(timer(2000));
      }
      this.error.set(
        'Tu envío se aplicó y los datos siguen actualizándose. Consulta el resultado sin repetir el envío.',
      );
    } catch (error: unknown) {
      if (epoch !== this.epoch) return;
      if (
        !receipt.operationId &&
        error instanceof ApplicationError &&
        [400, 403, 422].includes(error.status ?? 0)
      ) {
        this.save(null);
        this.error.set(
          'No pudimos enviar el formulario. Actualiza tu cita y verifica los datos y tu acceso.',
        );
      } else
        this.error.set(
          'No pudimos comprobar el resultado. Tu solicitud está guardada; vuelve a consultar sin duplicar el envío.',
        );
    } finally {
      if (epoch === this.epoch) this.busy.set(false);
    }
  }
}
