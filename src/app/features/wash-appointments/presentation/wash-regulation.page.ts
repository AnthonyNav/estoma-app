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
  readonly equipment = [
    'Uniforme completo',
    'Calzado limpio',
    'Bata de bioseguridad',
    'Cubre-bocas',
    'Careta',
    'Lentes',
    'Protección auditiva',
    'Guantes de nitrilo tipo industrial',
  ];

  readonly lineamientos = [
    {
      categoria: 'Reglas generales',
      items: [
        'Cartilla de vacunación vigente o, de lo contrario, bajo responsabilidad propia.',
        'Uso obligatorio de barreras de protección: EPP completo:',
        'Registro en el área de lavado ultrasónico con los PSS antes de entrar a la cabina (laboratorio de clínicas).',
        'Presentar credencial vigente.',
        'Inmediatamente después de la actividad clínica, realizar limpieza previa con gasa húmeda para eliminar el material orgánico e inorgánico (inspección de las puntas de trabajo del instrumental).',
        'En caso de traer limas, fresas o material pequeño, traer un infusor de té.',
        'Se prohíbe la entrada con mochilas o bolsas grandes a las cabinas.',
        'Queda prohibido el uso del celular durante el proceso.',
        'Queda prohibido ingerir alimentos.',
        'Transportar el instrumental de manera segura en cassette o en contenedor rígido (zona de riesgo). Separar instrumental codificado con cinta o goma del mismo color para control.',
        'Queda prohibido el uso de paños de tela; solo papel para secar.',
        'En caso de accidente, lesión o punción, reportar a la Jefatura de Clínicas para dar seguimiento al riesgo biológico.',
        'Realizar la selección de basura de manera adecuada.',
        'Uso exclusivo para estudiantes cursando la clínica.',
        'El procedimiento debe realizarse de manera individual. Está prohibido recibir remuneración o cobrar por realizar dicho proceso.',
        'Toda cucharilla de impresión debe realizar su proceso de lavado ultrasónico en la clínica de toma de impresiones, separado del instrumental. Está prohibido recibir remuneración o cobrar por realizar dicho proceso.',
        'Número máximo de 5 alumnos en el área para desarrollar el lavado.',
        'El proceso no debe durar más de 15 minutos y debe realizarse de manera personal.',
        'Toda persona ajena que haga uso de la infraestructura de la Unidad Académica será reportada ante las autoridades.',
        'Es obligatorio reportar daños y material olvidado.',
      ],
    },
    {
      categoria: 'Proceso de lavado ultrasónico',
      items: [
        'Desinfectar las superficies de trabajo antes y después de su uso. Es obligatorio el uso de guantes.',
        'Realizar limpieza previa del instrumental.',
        'Las tinas se encuentran programadas por 15 minutos; solo se debe activar el encendido.',
        'Enjuagar de manera abundante. Es obligatorio el uso de guantes.',
        'Realizar secado a presión del instrumental.',
        'El CEyE entrega el papel para esterilizar y 3 pulgadas de cinta testigo.',
        'Sellar perfectamente y rotular con datos personales.',
        'Se entregará el paquete con sello del Programa de Control de Infecciones y con fecha, validando el proceso de esterilización.',
        'Separar el instrumental textil (campo quirúrgico, campo hendido y batas), plástico (cucharillas de impresión, Snap, etc.) y látex.',
        'Queda prohibido cortar bolsas para esterilizar.',
        'Seleccionar el tamaño correcto en caso necesario.',
        'Realizar el protocolo de desinfección de los guantes de nitrilo después de terminar el lavado del instrumental.',
        'Realizar el protocolo de lavado de manos al finalizar el proceso.',
        'El proceso será supervisado por los Pasantes de Servicio Social.',
      ],
    },
  ];

  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);

  constructor() {
    if (this.registration.pendingSchedule())
      void this.router.navigate(['/wash/appointments/availability']);
  }

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
