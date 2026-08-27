import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideCheck, LucideX } from '@lucide/angular';

import { ListRegistrosUseCase } from '../application/list-registros.use-case';
import { ValidarRegistroUseCase } from '../application/validar-registro.use-case';
import { Registro, RegistroEstado } from '../domain/models/registro';

const BADGE_BY_ESTADO: Record<RegistroEstado, string> = {
  PENDIENTE_VALIDACION: 'badge-in-process',
  CONFIRMADO: 'badge-available',
  RECHAZADO: 'badge-disabled',
  CANCELADO_ALUMNO: 'badge-maintenance',
  CANCELADO_JORNADA_CANCELADA: 'badge-maintenance',
};

const LABEL_BY_ESTADO: Record<RegistroEstado, string> = {
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  CANCELADO_ALUMNO: 'Cancelado por el Alumno',
  CANCELADO_JORNADA_CANCELADA: 'Jornada cancelada',
};

@Component({
  selector: 'app-registros-list-page',
  imports: [LucideCheck, LucideX],
  templateUrl: './registros-list.page.html',
  styleUrl: './registros-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrosListPage {
  private readonly listRegistros = inject(ListRegistrosUseCase);
  private readonly validarRegistro = inject(ValidarRegistroUseCase);

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
    this.listRegistros.execute().subscribe((registros) => {
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
    this.validarRegistro.confirmar(registro.registroId).subscribe({
      next: () => {
        this.workingId.set(null);
        this.refresh();
      },
      error: () => this.workingId.set(null),
    });
  }

  rechazar(registro: Registro): void {
    const motivo = window.prompt(`Motivo de rechazo para "${registro.alumnoNombre}":`);
    if (!motivo) {
      return;
    }
    this.workingId.set(registro.registroId);
    this.validarRegistro.rechazar({ registroId: registro.registroId, motivo }).subscribe({
      next: () => {
        this.workingId.set(null);
        this.refresh();
      },
      error: () => this.workingId.set(null),
    });
  }
}
