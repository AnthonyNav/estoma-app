import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCalendarDays,
  LucideMapPin,
  LucidePlus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';

import { CancelarJornadaUseCase } from '../application/cancelar-jornada.use-case';
import { ListJornadasUseCase } from '../application/list-jornadas.use-case';
import { PublicarJornadaUseCase } from '../application/publicar-jornada.use-case';
import { Jornada, JornadaEstado, TipoJornada } from '../domain/models/jornada';

const BADGE_BY_ESTADO: Record<JornadaEstado, string> = {
  PUBLICADA: 'badge-available',
  CANCELADA: 'badge-disabled',
  FINALIZADA: 'badge-maintenance',
};

const LABEL_BY_ESTADO: Record<JornadaEstado, string> = {
  PUBLICADA: 'Publicada',
  CANCELADA: 'Cancelada',
  FINALIZADA: 'Finalizada',
};

@Component({
  selector: 'app-jornadas-list-page',
  imports: [
    ReactiveFormsModule,
    LucideCalendarDays,
    LucideMapPin,
    LucidePlus,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './jornadas-list.page.html',
  styleUrl: './jornadas-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JornadasListPage {
  private readonly listJornadas = inject(ListJornadasUseCase);
  private readonly publicarJornada = inject(PublicarJornadaUseCase);
  private readonly cancelarJornada = inject(CancelarJornadaUseCase);
  private readonly formBuilder = inject(FormBuilder);

  readonly jornadas = signal<Jornada[]>([]);
  readonly tipos = signal<TipoJornada[]>([]);
  readonly loading = signal(true);
  readonly formOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly cancelingId = signal<string | null>(null);

  readonly vigentes = computed(() => this.jornadas().filter((j) => j.estado === 'PUBLICADA'));
  readonly historicas = computed(() => this.jornadas().filter((j) => j.estado !== 'PUBLICADA'));

  readonly form = this.formBuilder.nonNullable.group({
    tipoJornadaId: ['', Validators.required],
    nombre: ['', Validators.required],
    fecha: ['', Validators.required],
    horaInicio: ['09:00', Validators.required],
    horaFin: ['13:00', Validators.required],
    lugar: ['', Validators.required],
    cupoTotal: [20, [Validators.required, Validators.min(0)]],
    fechaLimiteDocumentos: ['', Validators.required],
    descripcion: [''],
  });

  constructor() {
    this.listJornadas.tipos().subscribe((tipos) => this.tipos.set(tipos));
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.listJornadas.execute().subscribe((jornadas) => {
      this.jornadas.set(jornadas);
      this.loading.set(false);
    });
  }

  badgeClass(estado: JornadaEstado): string {
    return BADGE_BY_ESTADO[estado];
  }

  estadoLabel(estado: JornadaEstado): string {
    return LABEL_BY_ESTADO[estado];
  }

  openForm(): void {
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.form.reset({ horaInicio: '09:00', horaFin: '13:00', cupoTotal: 20 });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.formError.set(null);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.publicarJornada.execute({ ...raw, descripcion: raw.descripcion || undefined }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeForm();
        this.refresh();
      },
      error: (error: Error) => {
        this.submitting.set(false);
        this.formError.set(error.message);
      },
    });
  }

  cancelar(jornada: Jornada): void {
    const motivo = window.prompt(`Motivo de cancelación para "${jornada.nombre}":`);
    if (!motivo) {
      return;
    }
    this.cancelingId.set(jornada.jornadaId);
    this.cancelarJornada.execute({ jornadaId: jornada.jornadaId, motivo }).subscribe({
      next: () => {
        this.cancelingId.set(null);
        this.refresh();
      },
      error: () => {
        this.cancelingId.set(null);
      },
    });
  }
}
