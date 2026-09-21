import { SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { LucideCheck, LucideX } from '@lucide/angular';

import { rejectionMessage } from '../../../core/api/durable-operation';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { ListRegistrosUseCase } from '../application/list-registros.use-case';
import { ValidarRegistroUseCase } from '../application/validar-registro.use-case';
import { Registro, RegistroEstado } from '../domain/models/registro';

const BADGE_BY_ESTADO: Record<RegistroEstado, string> = {
  PENDIENTE_VALIDACION: 'badge-in-process',
  CONFIRMADO: 'badge-available',
  RECHAZADO: 'badge-disabled',
  CANCELADO_ALUMNO: 'badge-maintenance',
  CANCELADO_JORNADA_CANCELADA: 'badge-maintenance',
  COMPLETADO: 'badge-available',
};

const LABEL_BY_ESTADO: Record<RegistroEstado, string> = {
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  CANCELADO_ALUMNO: 'Cancelado por el Alumno',
  CANCELADO_JORNADA_CANCELADA: 'Jornada cancelada',
  COMPLETADO: 'Completado',
};

@Component({
  selector: 'app-registros-list-page',
  imports: [SlicePipe, LucideCheck, LucideX],
  templateUrl: './registros-list.page.html',
  styleUrl: './registros-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrosListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly listRegistros = inject(ListRegistrosUseCase);
  private readonly validarRegistro = inject(ValidarRegistroUseCase);
  private readonly tracker = inject(OperationTrackerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly jornadaId = this.route.snapshot.paramMap.get('jornadaId')!;

  readonly registros = signal<Registro[]>([]);
  readonly loading = signal(true);
  readonly workingId = signal<string | null>(null);

  readonly pendientes = computed(() =>
    this.registros().filter((r) => r.estado === 'PENDIENTE_VALIDACION'),
  );
  readonly resueltos = computed(() =>
    this.registros().filter((r) => r.estado !== 'PENDIENTE_VALIDACION'),
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.listRegistros
      .deJornada(this.jornadaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((registros) => {
        this.registros.set(registros);
        this.loading.set(false);
      });
  }

  badgeClass(estado: RegistroEstado): string {
    return BADGE_BY_ESTADO[estado];
  }

  estadoLabel(estado: RegistroEstado): string {
    return LABEL_BY_ESTADO[estado];
  }

  confirmar(registro: Registro): void {
    this.workingId.set(registro.registroId);
    this.validarRegistro
      .confirmar(registro.registroId, crypto.randomUUID())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => this.track(operationId),
        error: () => this.workingId.set(null),
      });
  }

  rechazar(registro: Registro): void {
    const motivo = window.prompt(`Motivo de rechazo para el Registro ${registro.registroId}:`);
    if (!motivo) {
      return;
    }
    this.workingId.set(registro.registroId);
    this.validarRegistro
      .rechazar({ registroId: registro.registroId, motivo, idempotencyKey: crypto.randomUUID() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => this.track(operationId),
        error: () => this.workingId.set(null),
      });
  }

  private track(operationId: string): void {
    this.tracker
      .trackWith(() => this.validarRegistro.getOperation(operationId), { maxPendingPolls: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'PENDING') return;
          this.workingId.set(null);
          if (operation.status === 'SUCCEEDED') this.refresh();
          else window.alert(rejectionMessage(operation));
        },
        error: () => this.workingId.set(null),
      });
  }
}
