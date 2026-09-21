import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OperationalResourcesService,
  OperationalResource,
  ResourceUnavailability,
} from '../application/operational-resources.service';

@Component({
  selector: 'app-operational-resources-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './operational-resources.page.html',
  styleUrl: './operational-resources.page.scss',
})
export class OperationalResourcesPage {
  readonly flow = inject(OperationalResourcesService);
  readonly loading = signal(false);
  selected: OperationalResource | null = null;
  unavailable?: ResourceUnavailability;
  reason = '';
  constructor() {
    this.refresh();
  }
  administrativeLabel(status: string): string {
    return status === 'ACTIVE' ? 'Activa' : status === 'INACTIVE' ? 'Inactiva' : 'Por verificar';
  }
  select(resource: OperationalResource, unavailable?: ResourceUnavailability): void {
    this.selected = resource;
    this.unavailable = unavailable;
    this.reason = '';
  }
  refresh(): void {
    if (this.loading()) return;
    this.selected = null;
    this.loading.set(true);
    void this.flow.load().finally(() => this.loading.set(false));
  }
  submit(): void {
    if (this.selected) this.flow.start(this.selected, this.reason, this.unavailable);
    this.selected = null;
  }
}
