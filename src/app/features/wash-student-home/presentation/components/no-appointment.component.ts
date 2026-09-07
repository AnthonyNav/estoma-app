import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-appointment',
  imports: [RouterLink],
  templateUrl: './no-appointment.component.html',
  styleUrl: './no-appointment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoAppointmentComponent {}
