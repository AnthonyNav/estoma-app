import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  MockWashJourneyStore,
  StudentHomeFixture,
} from '../../wash-student-home/infrastructure/mock/mock-wash-journey.store';

type WashActor = 'Alumno' | 'Supervisor' | 'Administrador';

interface FixtureUseCase {
  code: string;
  actor: WashActor;
  title: string;
  description: string;
  path: string;
  fixture: StudentHomeFixture | null;
  steps: string;
}

@Component({
  selector: 'app-wash-fixture-gallery-page',
  imports: [RouterLink],
  templateUrl: './wash-fixture-gallery.page.html',
  styleUrl: './wash-fixture-gallery.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashFixtureGalleryPage {
  private readonly router = inject(Router);
  private readonly journey = inject(MockWashJourneyStore);

  readonly useCases: readonly FixtureUseCase[] = [
    {
      code: 'WASH-STU-01',
      actor: 'Alumno',
      title: 'Consultar estado de lavado',
      description: 'Cita programada con QR opaco listo para ingreso.',
      path: '/wash/student',
      fixture: 'scheduled-entry-qr',
      steps: 'Ver estado, horario, QR y acciones permitidas.',
    },
    {
      code: 'WASH-STU-02',
      actor: 'Alumno',
      title: 'Registrar cita',
      description: 'Alumno sin cita: recorre reglamento, datos y disponibilidad.',
      path: '/wash/appointments/regulation',
      fixture: 'no-appointment',
      steps: 'Acepta reglamento → completa datos → elige horario → confirma.',
    },
    {
      code: 'WASH-STU-03',
      actor: 'Alumno',
      title: 'Presentar QR de ingreso',
      description: 'El QR se entrega y se consume como representación opaca.',
      path: '/wash/student',
      fixture: 'scheduled-entry-qr',
      steps: 'Abre el código y úsalo en la búsqueda QR de Supervisión.',
    },
    {
      code: 'WASH-STU-04',
      actor: 'Alumno',
      title: 'Registrar salida',
      description: 'Lavado en proceso con recurso asignado.',
      path: '/wash/student/exit',
      fixture: 'in-progress',
      steps: 'Captura materiales → envía → el estado pasa a revisión de salida.',
    },
    {
      code: 'WASH-STU-05',
      actor: 'Alumno',
      title: 'Cancelar cita',
      description: 'Cita programada dentro de la ventana de cancelación.',
      path: '/wash/student',
      fixture: 'scheduled-entry-qr',
      steps: 'Cancela y espera la operación durable; el QR deja de estar disponible.',
    },
    {
      code: 'WASH-SUP-06',
      actor: 'Supervisor',
      title: 'Home y consulta unificada',
      description: 'Resumen del día y punto de entrada de búsqueda.',
      path: '/wash/supervision',
      fixture: 'scheduled-entry-qr',
      steps: 'Elige ingreso o salida; escanea el QR o abre la lista de búsqueda manual.',
    },
    {
      code: 'WASH-SUP-01',
      actor: 'Supervisor',
      title: 'Registrar llegada y decidir ingreso',
      description: 'Cita programada para la matrícula de prueba 201945678.',
      path: '/wash/supervision/entry',
      fixture: 'scheduled-entry-qr',
      steps:
        'Escanea o abre Búsqueda manual → selecciona una cita registrada → registra llegada → autoriza o rechaza.',
    },
    {
      code: 'WASH-SUP-02',
      actor: 'Supervisor',
      title: 'Resolver reasignación',
      description: 'Ejecución pendiente con candidatos de recurso.',
      path: '/wash/supervision/reassignments',
      fixture: 'pending-reassignment',
      steps: 'Consulta candidatos → reasigna; el mock actualiza el estado compartido.',
    },
    {
      code: 'WASH-SUP-03',
      actor: 'Supervisor',
      title: 'Revisar salida y completar',
      description: 'Salida del alumno enviada con materiales declarados.',
      path: '/wash/supervision/exit',
      fixture: 'exit-submitted',
      steps:
        'Escanea o abre Búsqueda manual → selecciona una cita en proceso → revisa materiales → completa.',
    },
    {
      code: 'WASH-SUP-04',
      actor: 'Supervisor',
      title: 'Gestionar recursos operativos',
      description: 'Indisponibilidad temporal distinta al estado administrativo.',
      path: '/wash/supervision/resources',
      fixture: null,
      steps: 'Indica causa y motivo → deshabilita o restaura el recurso.',
    },
    {
      code: 'WASH-SUP-05',
      actor: 'Supervisor',
      title: 'Gestionar autorización excepcional',
      description: 'Contexto académico y autorización sin exponer reglas calculadas en UI.',
      path: '/wash/supervision/exceptional-authorizations',
      fixture: null,
      steps: 'Busca matrícula → concede o cancela la autorización excepcional.',
    },
    {
      code: 'WASH-ADM-01',
      actor: 'Administrador',
      title: 'Dashboard de lavado',
      description: 'Configuración actual, calendario y capacidad configurada.',
      path: '/wash/admin',
      fixture: null,
      steps: 'Consulta el resumen administrativo; no representa ocupación física.',
    },
    {
      code: 'WASH-ADM-02',
      actor: 'Administrador',
      title: 'Operación semanal',
      description: 'Preview y reemplazo atómico de la intención de un día.',
      path: '/wash/admin/operation',
      fixture: null,
      steps: 'Edita → vista previa de impacto → reemplaza el día y relee.',
    },
    {
      code: 'WASH-ADM-03',
      actor: 'Administrador',
      title: 'Gestionar recursos',
      description: 'Consulta de cabinas/tinas y estados administrativos.',
      path: '/wash/admin/resources',
      fixture: null,
      steps: 'Inspecciona configuración y prueba los cambios de estado disponibles.',
    },
    {
      code: 'WASH-ADM-04',
      actor: 'Administrador',
      title: 'Gestionar supervisores',
      description: 'Listado, búsqueda y alta resumible sin contraseña visible.',
      path: '/wash/admin/supervisors',
      fixture: null,
      steps: 'Busca o inicia alta; la credencial temporal nunca aparece en navegador.',
    },
  ];

  run(useCase: FixtureUseCase): void {
    if (useCase.fixture) {
      this.journey.applyFixture(useCase.fixture);
    }
    void this.router.navigateByUrl(useCase.path);
  }
}
