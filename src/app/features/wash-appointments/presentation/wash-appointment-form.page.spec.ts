import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { WashAppointmentRegistrationUseCase } from '../application/wash-appointment-registration.use-case';
import { AppointmentRegistrationDraftService } from './appointment-registration-draft.service';
import { WashAppointmentFormPage } from './wash-appointment-form.page';

const sections = [
  { courseSectionId: 'course-a', nrc: '12345', name: 'Clínica A' },
  { courseSectionId: 'course-b', nrc: '67890', name: 'Clínica B' },
];
describe('WashAppointmentFormPage', () => {
  let useCase: jasmine.SpyObj<WashAppointmentRegistrationUseCase>;
  beforeEach(() => {
    useCase = jasmine.createSpyObj('registration', ['getFormContext']);
    useCase.getFormContext.and.returnValue(
      of({
        student: { fullName: 'Ana', studentEnrollment: '123', currentSemester: 7 },
        availableCourseSections: sections,
      }),
    );
    TestBed.configureTestingModule({
      imports: [WashAppointmentFormPage],
      providers: [
        provideRouter([]),
        { provide: WashAppointmentRegistrationUseCase, useValue: useCase },
      ],
    });
    TestBed.inject(AppointmentRegistrationDraftService).acceptRegulation(true);
  });
  it('requires an explicit choice when multiple courses are available and reports missing selection', () => {
    const page = TestBed.createComponent(WashAppointmentFormPage).componentInstance;
    expect(page.form.controls.courseSectionId.value).toBe('');
    page.submit();
    expect(page.validationSummaryVisible()).toBeTrue();
    expect(page.form.controls.courseSectionId.touched).toBeTrue();
  });
  it('selects the only available course', () => {
    useCase.getFormContext.and.returnValue(
      of({
        student: { fullName: 'Ana', studentEnrollment: '123' },
        availableCourseSections: [sections[0]],
      }),
    );
    expect(
      TestBed.createComponent(WashAppointmentFormPage).componentInstance.form.controls
        .courseSectionId.value,
    ).toBe('course-a');
  });
  it('preserves a valid course choice when returning to the form', () => {
    TestBed.inject(AppointmentRegistrationDraftService).update({
      appointmentType: 'NORMAL',
      instrumentCount: 5,
      pieceType: 'HIGH_SPEED',
      courseSectionId: 'course-b',
    });
    expect(
      TestBed.createComponent(WashAppointmentFormPage).componentInstance.form.controls
        .courseSectionId.value,
    ).toBe('course-b');
  });
  it('enforces integer counts and type limits for typed values and counter buttons', () => {
    const page = TestBed.createComponent(WashAppointmentFormPage).componentInstance;
    const count = page.form.controls.instrumentCount;
    count.setValue(1);
    page.adjustInstrumentCount(-1);
    expect(count.value).toBe(1);
    page.form.controls.appointmentType.setValue('JOURNEY');
    count.setValue(80);
    page.adjustInstrumentCount(1);
    expect(count.value).toBe(80);
    page.form.controls.appointmentType.setValue('NORMAL');
    expect(count.hasError('max')).toBeTrue();
    expect(count.touched).toBeTrue();
    count.setValue(1.5);
    expect(count.hasError('integer')).toBeTrue();
  });
  it('saves valid data and opens the separate availability step', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const page = TestBed.createComponent(WashAppointmentFormPage).componentInstance;
    page.form.patchValue({
      courseSectionId: 'course-b',
      instrumentCount: 8,
      pieceType: 'LOW_SPEED',
    });
    page.submit();
    expect(TestBed.inject(AppointmentRegistrationDraftService).draft().instrumentCount).toBe(8);
    expect(navigate).toHaveBeenCalledWith(['/wash/appointments/availability']);
  });
});
