import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ListJornadasUseCase } from '../../jornadas/application/list-jornadas.use-case';
import { Jornada } from '../../jornadas/domain/models/jornada';
import { ListRegistrosUseCase } from '../../registros/application/list-registros.use-case';
import { Registro } from '../../registros/domain/models/registro';

interface StatCard {
  label: string;
  value: number;
  variant: 'available' | 'in-process' | 'disabled' | 'maintenance';
}

@Component({
  selector: 'app-estadisticas-page',
  imports: [],
  templateUrl: './estadisticas.page.html',
  styleUrl: './estadisticas.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadisticasPage {
  private readonly listJornadas = inject(ListJornadasUseCase);
  private readonly listRegistros = inject(ListRegistrosUseCase);

  readonly loading = signal(true);
  private readonly jornadas = signal<Jornada[]>([]);
  private readonly registros = signal<Registro[]>([]);

  readonly jornadaStats = computed<StatCard[]>(() => {
    const jornadas = this.jornadas();
    return [
      {
        label: 'Publicadas',
        value: jornadas.filter((j) => j.estado === 'PUBLICADA').length,
        variant: 'available',
      },
      {
        label: 'Canceladas',
        value: jornadas.filter((j) => j.estado === 'CANCELADA').length,
        variant: 'disabled',
      },
      {
        label: 'Finalizadas',
        value: jornadas.filter((j) => j.estado === 'FINALIZADA').length,
        variant: 'maintenance',
      },
    ];
  });

  readonly registroStats = computed<StatCard[]>(() => {
    const registros = this.registros();
    return [
      {
        label: 'Pendientes de validación',
        value: registros.filter((r) => r.estado === 'PENDIENTE_VALIDACION').length,
        variant: 'in-process',
      },
      {
        label: 'Confirmados',
        value: registros.filter((r) => r.estado === 'CONFIRMADO').length,
        variant: 'available',
      },
      {
        label: 'Rechazados',
        value: registros.filter((r) => r.estado === 'RECHAZADO').length,
        variant: 'disabled',
      },
      {
        label: 'Cancelados',
        value: registros.filter(
          (r) => r.estado === 'CANCELADO_ALUMNO' || r.estado === 'CANCELADO_JORNADA_CANCELADA',
        ).length,
        variant: 'maintenance',
      },
    ];
  });

  readonly cupoPorJornada = computed(() => {
    const registros = this.registros();
    return this.jornadas()
      .filter((j) => j.estado === 'PUBLICADA')
      .map((jornada) => {
        const ocupados = registros.filter(
          (r) =>
            r.jornadaId === jornada.jornadaId &&
            (r.estado === 'PENDIENTE_VALIDACION' || r.estado === 'CONFIRMADO'),
        ).length;
        return { jornada, ocupados, disponibles: Math.max(0, jornada.cupoTotal - ocupados) };
      });
  });

  constructor() {
    forkJoin({
      jornadas: this.listJornadas.execute(),
      registros: this.listRegistros.execute(),
    }).subscribe(({ jornadas, registros }) => {
      this.jornadas.set(jornadas);
      this.registros.set(registros);
      this.loading.set(false);
    });
  }
}
