import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideCalendarDays,
  LucideMapPin,
  LucidePlus,
  LucideUserPlus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';

import { rejectionMessage } from '../../../core/api/durable-operation';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { CrearRegistroUseCase } from '../../registros/application/crear-registro.use-case';
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
    RouterLink,
    LucideCalendarDays,
    LucideMapPin,
    LucidePlus,
    LucideUserPlus,
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
  private readonly crearRegistro = inject(CrearRegistroUseCase);
  private readonly formBuilder = inject(FormBuilder);
  private readonly sessionStore = inject(SessionStore);
  private readonly tracker = inject(OperationTrackerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdministrador = computed(
    () => this.sessionStore.profile()?.roleCode === 'ADMINISTRADOR_PRACTICAS',
  );
  readonly isAlumno = computed(() => this.sessionStore.profile()?.roleCode === 'ALUMNO');

  readonly registeringId = signal<string | null>(null);

  readonly jornadas = signal<Jornada[]>([]);
  readonly tipos = signal<TipoJornada[]>([]);
  readonly loading = signal(true);
  readonly formOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly cancelingId = signal<string | null>(null);

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
    if (this.isAdministrador()) {
      this.listJornadas
        .tipos()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((tipos) => this.tipos.set(tipos));
    }
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.listJornadas
      .execute()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((jornadas) => {
        this.jornadas.set(jornadas);
        this.loading.set(false);
      });
  }

  tipoNombre(tipoJornadaId: string): string {
    return this.tipos().find((t) => t.tipoJornadaId === tipoJornadaId)?.nombre ?? 'Tipo';
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
    this.publicarJornada
      .execute({
        ...raw,
        descripcion: raw.descripcion || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => this.trackPublicar(operationId),
        error: (error: Error) => {
          this.submitting.set(false);
          this.formError.set(error.message);
        },
      });
  }

  private trackPublicar(operationId: string): void {
    this.tracker
      .trackWith(() => this.publicarJornada.getOperation(operationId), { maxPendingPolls: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'PENDING') return;
          this.submitting.set(false);
          if (operation.status === 'SUCCEEDED') {
            this.closeForm();
            this.refresh();
            return;
          }
          this.formError.set(rejectionMessage(operation));
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
    this.cancelarJornada
      .execute({ jornadaId: jornada.jornadaId, motivo, idempotencyKey: crypto.randomUUID() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => this.trackCancelar(operationId),
        error: () => this.cancelingId.set(null),
      });
  }

  private trackCancelar(operationId: string): void {
    this.tracker
      .trackWith(() => this.cancelarJornada.getOperation(operationId), { maxPendingPolls: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'PENDING') return;
          this.cancelingId.set(null);
          if (operation.status === 'SUCCEEDED') this.refresh();
          else window.alert(rejectionMessage(operation));
        },
        error: () => this.cancelingId.set(null),
      });
  }

  preRegistrarme(jornada: Jornada): void {
    this.registeringId.set(jornada.jornadaId);
    this.crearRegistro
      .execute({ jornadaId: jornada.jornadaId, idempotencyKey: crypto.randomUUID() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ operationId }) => this.trackPreRegistro(jornada, operationId),
        error: (error: Error) => {
          this.registeringId.set(null);
          window.alert(`No se pudo pre-registrar: ${error.message}`);
        },
      });
  }

  private trackPreRegistro(jornada: Jornada, operationId: string): void {
    this.tracker
      .trackWith(() => this.crearRegistro.getOperation(operationId), { maxPendingPolls: 30 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (operation) => {
          if (operation.status === 'PENDING') return;
          this.registeringId.set(null);
          if (operation.status === 'SUCCEEDED') {
            window.alert(
              `Pre-registro enviado para "${jornada.nombre}". Un Pasante revisará tu documentación.`,
            );
          } else {
            window.alert(`No se pudo pre-registrar: ${rejectionMessage(operation)}`);
          }
        },
        error: (error: Error) => {
          this.registeringId.set(null);
          window.alert(`No se pudo pre-registrar: ${error.message}`);
        },
      });
  }
}
