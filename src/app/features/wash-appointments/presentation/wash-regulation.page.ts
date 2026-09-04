import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';

@Component({
  selector: 'app-wash-regulation-page',
  imports: [RouterLink],
  templateUrl: './wash-regulation.page.html',
  styleUrl: './wash-regulation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashRegulationPage {
  readonly lineamientos = [
    {
      categoria: 'Requisitos y EPP',
      items: [
        'Cartilla de Vacunación vigente o de lo contrario bajo responsabilidad propia.',
        'Uso obligatorio de Barreras de protección: EPP/COMPLETO (Uniforme completo, Calzado limpio, Bata de bioseguridad, Cubre-bocas, Careta, Lentes, Protección auditiva y Guantes de nitrilo tipo industrial).',
        'Registro en el área de lavado ultrasónico con los PSS antes de entrar a la cabina (laboratorio de clínicas).',
        'Presentar credencial vigente.',
        'Uso exclusivo para estudiantes cursando la clínica.',
      ],
    },
    {
      categoria: 'Manejo de Instrumental y Seguridad',
      items: [
        'Inmediatamente después de la actividad clínica: limpieza previa con gasa húmeda para eliminar material orgánico e inorgánico (inspección de las puntas de trabajo del instrumental).',
        'En caso de traer limas, fresas o material pequeño, traer un infusor de té.',
        'Transportar el instrumental de manera segura en cassette o en contenedor rígido (zona de riesgo). Separar instrumental codificado con cinta o goma del mismo color.',
        'Toda cucharilla de impresión tiene su proceso de lavado ultrasónico en la clínica de toma de impresiones (separado del instrumental). Prohibido recibir remuneración/cobrar por este proceso.',
        'Queda prohibido el uso de paños de tela, solo papel para secar.',
      ],
    },
    {
      categoria: 'Reglas del Área y Capacidad',
      items: [
        'Número máximo de 5 alumnos en el área para desarrollar el lavado.',
        'Proceso no más de 15 minutos de manera personal.',
        'Se prohíbe la entrada con mochilas o bolsas grandes a las cabinas.',
        'Queda prohibido el uso del celular durante el proceso e ingerir alimentos.',
        'Toda persona ajena que haga uso de la infraestructura será reportada ante las autoridades.',
        'Es obligatorio reportar daños y material olvidado.',
        'En caso de accidente, lesión o punción, reportar a la Jefatura de Clínicas para dar seguimiento al riesgo biológico.',
      ],
    },
    {
      categoria: 'Proceso de Lavado y Esterilización',
      items: [
        'Desinfectar superficies de trabajo antes y después de su uso (uso obligatorio de guantes).',
        'Limpieza previa del instrumental. Las tinas se encuentran programadas por 15 minutos, solo activar el encendido.',
        'Enjuagar de manera abundante y realizar secado a presión del instrumental.',
        'El CEyE entrega el papel para esterilizar y 3 pulgadas de cinta testigo. Sellar perfectamente y rotular con datos personales.',
        'Separar el instrumental textil (campo quirúrgico, campo hendido y batas) como plástico (cucharillas de impresión, Snap, etc.) y látex.',
        'Queda prohibido cortar bolsas para esterilizar.',
        'Protocolo de desinfección de los guantes de nitrilo después de terminar y protocolo de lavado de manos al finalizar.',
        'El proceso será supervisado por los Pasantes de Servicio Social.',
      ],
    },
  ];

  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);

  readonly accepted = signal(this.registration.draft().regulationAccepted);

  setAccepted(event: Event): void {
    const accepted = (event.target as HTMLInputElement).checked;
    this.accepted.set(accepted);
    this.registration.acceptRegulation(accepted);
  }

  continue(): void {
    if (this.accepted()) {
      void this.router.navigate(['/wash/appointments/new']);
    }
  }
}
