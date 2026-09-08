import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SupervisorEntryLookup } from '../domain/models/supervisor-entry';

@Component({
  selector: 'app-entry-approved',
  templateUrl: './entry-approved.component.html',
  styleUrl: './entry-approved.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryApprovedComponent {
  readonly lookup = input.required<SupervisorEntryLookup>();
  readonly busy = input(false);
  readonly nextStudent = output<void>();
  readonly home = output<void>();
  readonly refresh = output<void>();
  typeLabel(): string {
    return {
      NORMAL: 'Normal',
      JOURNEY: 'Jornada clínica',
      IMMUNOCOMPROMISED: 'Inmunocomprometido',
    }[this.lookup().appointment.appointmentType];
  }
}
