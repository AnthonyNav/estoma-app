import {
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApplicationError } from '../../../core/api/application-error';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import { AppointmentFormContext } from '../domain/models/appointment-registration';
import { AppointmentType } from '../../wash-student-home/domain/models/student-wash-home';
import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';

const maximumInstruments: Record<AppointmentType, number> = {
  NORMAL: 40,
  JOURNEY: 80,
  IMMUNOCOMPROMISED: 40,
};

@Component({
  selector: 'app-wash-appointment-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './wash-appointment-form.page.html',
  styleUrl: './wash-appointment-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WashAppointmentFormPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly registration = inject(AppointmentRegistrationDraftService);
  private readonly appointmentRegistration = inject(WashAppointmentRegistrationUseCase);

  @ViewChild('validationSummary') private validationSummary?: ElementRef<HTMLElement>;

  readonly form = this.formBuilder.nonNullable.group({
    appointmentType: [this.registration.draft().appointmentType, Validators.required],
    instrumentCount: [
      this.registration.draft().instrumentCount,
      [Validators.required, Validators.min(1)],
    ],
    pieceType: [this.registration.draft().pieceType, Validators.required],
    courseSectionId: [this.registration.draft().courseSectionId, Validators.required],
  });
  readonly context = signal<AppointmentFormContext | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly validationSummaryVisible = signal(false);
  readonly instrumentMaximum = signal(40);

  constructor() {
    if (this.registration.pendingSchedule()) {
      void this.router.navigate(['/wash/appointments/availability']);
      return;
    }
    if (!this.registration.canContinue()) {
      void this.router.navigate(['/wash/appointments/regulation']);
      return;
    }

    this.updateInstrumentValidation(this.form.controls.appointmentType.value);
    this.form.controls.appointmentType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((appointmentType) => this.updateInstrumentValidation(appointmentType));
    this.loadContext();
  }

  submit(): void {
    if (this.loading() || this.error() || !this.context()?.availableCourseSections.length) return;
    if (
      !this.context()?.availableCourseSections.some(
        (section) => section.courseSectionId === this.form.controls.courseSectionId.value,
      )
    ) {
      this.form.controls.courseSectionId.setErrors({ unavailable: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationSummaryVisible.set(true);
      afterNextRender(() => this.validationSummary?.nativeElement.focus(), {
        injector: this.injector,
      });
      return;
    }

    const course = this.context()?.availableCourseSections.find(
      (section) => section.courseSectionId === this.form.controls.courseSectionId.value,
    );
    this.registration.update(
      this.form.getRawValue(),
      course ? `${course.nrc} · ${course.name}` : null,
    );
    void this.router.navigate(['/wash/appointments/availability']);
  }

  loadContext(): void {
    this.loading.set(true);
    this.error.set(null);

    this.appointmentRegistration
      .getFormContext()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (context) => {
          this.context.set(context);
          const course = this.form.controls.courseSectionId;
          if (
            !context.availableCourseSections.some(
              (section) => section.courseSectionId === course.value,
            )
          ) {
            course.setValue(
              context.availableCourseSections.length === 1
                ? context.availableCourseSections[0].courseSectionId
                : '',
            );
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof ApplicationError
              ? error.message
              : 'No fue posible preparar el formulario de la cita.',
          );
          this.loading.set(false);
        },
      });
  }

  focusField(id: string): void {
    const field = this.host.nativeElement.querySelector<HTMLElement>(`#${id}`);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  instrumentError(): string {
    const control = this.form.controls.instrumentCount;
    if (control.hasError('required')) return 'Indica cuántos instrumentos vas a llevar.';
    if (control.hasError('integer')) return 'Usa un número entero, sin decimales.';
    if (control.hasError('min')) return 'Debes registrar al menos 1 instrumento.';
    return `Para este tipo de lavado puedes llevar hasta ${this.instrumentMaximum()} instrumentos.`;
  }

  adjustInstrumentCount(delta: number): void {
    const control = this.form.controls.instrumentCount;
    const current = Number.isFinite(control.value) ? Math.trunc(control.value) : 0;
    control.setValue(Math.max(1, Math.min(this.instrumentMaximum(), current + delta)));
    control.markAsDirty();
    control.markAsTouched();
  }

  private updateInstrumentValidation(appointmentType: AppointmentType): void {
    this.instrumentMaximum.set(maximumInstruments[appointmentType]);
    const control = this.form.controls.instrumentCount;
    control.setValidators([
      Validators.required,
      (control) => (Number.isInteger(control.value) ? null : { integer: true }),
      Validators.min(1),
      Validators.max(maximumInstruments[appointmentType]),
    ]);
    control.updateValueAndValidity({ emitEvent: false });
    if (control.invalid) control.markAsTouched();
  }
}
