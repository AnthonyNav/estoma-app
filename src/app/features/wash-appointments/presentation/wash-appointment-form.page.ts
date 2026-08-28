import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
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
  readonly instrumentMaximum = computed(
    () => maximumInstruments[this.form.controls.appointmentType.value],
  );

  constructor() {
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationSummaryVisible.set(true);
      setTimeout(() => this.validationSummary?.nativeElement.focus());
      return;
    }

    this.registration.update(this.form.getRawValue());
    void this.router.navigate(['/wash/appointments/availability']);
  }

  private loadContext(): void {
    this.loading.set(true);
    this.error.set(null);

    this.appointmentRegistration.getFormContext().subscribe({
      next: (context) => {
        this.context.set(context);
        if (!this.form.controls.courseSectionId.value && context.availableCourseSections[0]) {
          this.form.controls.courseSectionId.setValue(
            context.availableCourseSections[0].courseSectionId,
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

  private updateInstrumentValidation(appointmentType: AppointmentType): void {
    const control = this.form.controls.instrumentCount;
    control.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(maximumInstruments[appointmentType]),
    ]);
    control.updateValueAndValidity({ emitEvent: false });
  }
}
