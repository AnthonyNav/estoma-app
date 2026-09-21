import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppointmentRegistrationDraftService } from '../../features/wash-appointments/presentation/appointment-registration-draft.service';

const RECEIPTS = [
  ['session', 'estoma.booking.receipts.v1'],
  ['session', 'estoma.cancellation.receipts.v1'],
  ['session', 'estoma.entry.receipts.v2'],
  ['session', 'estoma.reassignment.receipts.v1'],
  ['session', 'estoma.student-exit.receipts.v1'],
  ['session', 'estoma.supervisor-exit.receipts.v1'],
  ['local', 'estoma.operational-resources.receipts.v1'],
  ['local', 'estoma.exceptional-authorizations.receipts.v1'],
] as const;

@Injectable({ providedIn: 'root' })
export class UpdateSafetyService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly draft = inject(AppointmentRegistrationDraftService);
  readonly requests = signal(0);

  /** Re-evaluated immediately before reload; never clears receipts or forms. */
  reason(): string | null {
    if (this.requests() > 0) return 'Esperamos a que terminen las solicitudes en curso.';
    try {
      for (const [kind, key] of RECEIPTS) {
        const storage = kind === 'local' ? localStorage : sessionStorage;
        const raw = storage.getItem(key);
        if (!raw) continue;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object') throw new Error('Invalid receipt store');
        if (Object.keys(value).length > 0)
          return 'Resuelve las solicitudes en seguimiento antes de actualizar.';
      }
    } catch {
      return 'No pudimos comprobar las solicitudes guardadas. No recargaremos la aplicación.';
    }
    const draft = this.draft.draft();
    if (
      draft.regulationAccepted ||
      draft.courseSectionId ||
      draft.instrumentCount !== 15 ||
      draft.appointmentType !== 'NORMAL' ||
      draft.pieceType !== 'HIGH_SPEED' ||
      this.draft.selectedTimeSlot()
    )
      return 'Hay una cita en preparación. Termina o cancela ese proceso antes de actualizar.';
    if (
      this.document.querySelector(
        'dialog[open], form.ng-dirty, input.ng-dirty, textarea.ng-dirty, select.ng-dirty',
      )
    )
      return 'Hay un formulario o una confirmación abiertos. Termina antes de actualizar.';
    // Also protects autofilled credentials and plain/native forms without Angular dirty state.
    for (const field of this.document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    )) {
      if (field.type === 'hidden' || field.type === 'radio' || field.type === 'checkbox') continue;
      if (field.value !== field.defaultValue)
        return 'Hay datos capturados. Termina antes de actualizar.';
    }
    const path = this.router.url.split(/[?#]/)[0];
    if (!['/authentication/sign-in', '/wash/student', '/wash/supervision'].includes(path))
      return 'Para actualizar, termina tu tarea y vuelve al inicio.';
    return null;
  }
}
