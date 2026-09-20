import { Component, inject } from '@angular/core';
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
  template: ` <main>
    <a routerLink="/wash/supervision">Volver a supervisión</a>
    <h1>Gestionar cabinas y tinas</h1>
    <p>
      Las inhabilitaciones operativas se gestionan por separado de la activación administrativa y la
      ocupación.
    </p>
    <p role="status">{{ flow.message() }}</p>
    @if (flow.pending(); as pending) {
      <section>
        <h2>Solicitud en seguimiento: {{ pending.label }}</h2>
        <p>No repitas el cambio mientras comprobamos el resultado.</p>
        <button [disabled]="flow.busy()" (click)="flow.resume()">Consultar resultado</button>
      </section>
    }
    <button [disabled]="flow.busy()" (click)="refresh()">Actualizar recursos</button>
    @if (flow.loaded() && !flow.resources().length) {
      <p>No hay recursos registrados.</p>
    }
    @for (resource of flow.resources(); track resource.resourceId) {
      <article>
        <h2>
          {{ resource.resourceType === 'CABIN' ? 'Cabina' : 'Tina' }} {{ resource.code }} ·
          {{ resource.name }}
        </h2>
        <p>Estado administrativo: {{ resource.administrativeStatus }}</p>
        @for (
          unavailable of resource.unavailabilities;
          track unavailable.resourceUnavailabilityId
        ) {
          <p>Inhabilitada: {{ unavailable.reason }}</p>
          <button
            [disabled]="!!flow.pending() || flow.busy()"
            (click)="select(resource, unavailable)"
          >
            Restablecer
          </button>
        } @empty {
          <p>Sin inhabilitaciones operativas registradas</p>
          <button
            [disabled]="
              resource.administrativeStatus !== 'ACTIVE' || !!flow.pending() || flow.busy()
            "
            (click)="select(resource)"
          >
            Inhabilitar
          </button>
        }
      </article>
    }
    @if (selected && !flow.pending()) {
      <form (ngSubmit)="submit()">
        <h2>{{ unavailable ? 'Restablecer' : 'Inhabilitar' }} {{ selected.name }}</h2>
        <label for="resource-reason">{{
          unavailable ? 'Motivo de resolución' : 'Motivo de inhabilitación'
        }}</label>
        <textarea
          id="resource-reason"
          name="reason"
          [(ngModel)]="reason"
          required
          maxlength="500"
        ></textarea>
        <button type="submit" [disabled]="!reason.trim() || flow.busy()">Confirmar cambio</button>
        <button type="button" (click)="selected = null">Cancelar</button>
      </form>
    }
  </main>`,
  styles: [
    `
      :host {
        display: block;
        background: #f5f7f9;
        min-height: 100dvh;
      }
      main {
        max-width: 850px;
        margin: auto;
        padding: 24px;
      }
      article,
      section,
      form {
        background: white;
        padding: 20px;
        margin: 16px 0;
        border-radius: 12px;
      }
      button {
        padding: 10px 16px;
        margin: 6px;
        border: 1px solid #52646a;
        border-radius: 8px;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      textarea {
        display: block;
        width: 100%;
        min-height: 100px;
        margin: 12px 0;
      }
      h1,
      h2 {
        color: #163c44;
      }
    `,
  ],
})
export class OperationalResourcesPage {
  readonly flow = inject(OperationalResourcesService);
  selected: OperationalResource | null = null;
  unavailable?: ResourceUnavailability;
  reason = '';
  constructor() {
    void this.flow.load();
  }
  select(resource: OperationalResource, unavailable?: ResourceUnavailability): void {
    this.selected = resource;
    this.unavailable = unavailable;
    this.reason = '';
  }
  refresh(): void {
    this.selected = null;
    void this.flow.load();
  }
  submit(): void {
    if (this.selected) this.flow.start(this.selected, this.reason, this.unavailable);
    this.selected = null;
  }
}
