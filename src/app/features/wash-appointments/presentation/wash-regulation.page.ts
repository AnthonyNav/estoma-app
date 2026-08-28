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
