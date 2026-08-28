import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApplicationError } from '../../../core/api/application-error';
import { StudentWashHome } from '../domain/models/student-wash-home';
import {
  STUDENT_WASH_HOME_GATEWAY,
  StudentWashHomeGateway,
} from '../domain/ports/student-wash-home.gateway';
import { StudentWashHomePage } from './student-wash-home.page';

const student = {
  firstName: 'Ana',
  fullName: 'Ana García Reyes',
  studentEnrollment: '201945678',
  currentSemester: 7,
};

const appointment = {
  appointmentId: '11111111-1111-1111-1111-111111111111',
  appointmentStatus: 'SCHEDULED' as const,
  appointmentType: 'NORMAL' as const,
  instrumentCount: 15,
  pieceType: 'HIGH_SPEED' as const,
  courseSection: {
    courseSectionId: '22222222-2222-2222-2222-222222222222',
    nrc: '12345',
    name: 'Cirugía Bucal',
  },
  timeSlot: {
    appointmentTimeSlotId: '33333333-3333-3333-3333-333333333333',
    startsAt: '2026-08-27T10:00:00-06:00',
    endsAt: '2026-08-27T11:00:00-06:00',
    timezone: 'America/Mexico_City',
  },
  washExecution: null,
  qrUsageContext: 'NONE' as const,
  qrRepresentation: null,
};

const homeWith = (data: StudentWashHome['appointment']): StudentWashHome => ({
  student,
  serviceDate: '2026-08-27',
  appointment: data,
});

describe('StudentWashHomePage', () => {
  let gateway: jasmine.SpyObj<StudentWashHomeGateway>;

  beforeEach(async () => {
    gateway = jasmine.createSpyObj<StudentWashHomeGateway>('StudentWashHomeGateway', ['loadHome']);

    await TestBed.configureTestingModule({
      imports: [StudentWashHomePage],
      providers: [
        provideRouter([]),
        {
          provide: STUDENT_WASH_HOME_GATEWAY,
          useValue: gateway,
        },
      ],
    }).compileComponents();
  });

  it('shows the appointment registration CTA when the student has no appointment', () => {
    gateway.loadHome.and.returnValue(of(homeWith(null)));

    const fixture = TestBed.createComponent(StudentWashHomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No tienes cita registrada hoy');
    expect(fixture.nativeElement.textContent).toContain('Registrar cita');
  });

  it('asks the student to sign in again when their session has expired', () => {
    gateway.loadHome.and.returnValue(
      throwError(() => new ApplicationError('authentication', 'Sesión expirada', 401)),
    );

    const fixture = TestBed.createComponent(StudentWashHomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tu sesión terminó');
    expect(
      (fixture.nativeElement.querySelector('a.button') as HTMLAnchorElement).getAttribute('href'),
    ).toBe('/authentication/sign-in');
  });

  it('shows a pending-entry status without inventing a resource assignment', () => {
    gateway.loadHome.and.returnValue(
      of(
        homeWith({
          ...appointment,
          washExecution: {
            washExecutionId: '44444444-4444-4444-4444-444444444444',
            status: 'PENDING_ENTRY',
          },
        }),
      ),
    );

    const fixture = TestBed.createComponent(StudentWashHomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esperando validación');
    expect(fixture.nativeElement.textContent).not.toContain('Espacio asignado');
  });

  it('opens the QR dialog and returns focus to its trigger when it closes', () => {
    gateway.loadHome.and.returnValue(
      of(
        homeWith({
          ...appointment,
          qrUsageContext: 'ENTRY',
          qrRepresentation: 'student-appointment-token',
        }),
      ),
    );

    const fixture = TestBed.createComponent(StudentWashHomePage);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const trigger = Array.from(buttons).find((button) =>
      button.textContent?.includes('Ampliar QR'),
    );
    expect(trigger).withContext('QR trigger').toBeDefined();
    trigger!.focus();
    trigger!.click();

    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();

    dialog.close();
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger!);
  });

  it('shows the reason recorded when entry has been rejected', () => {
    gateway.loadHome.and.returnValue(
      of(
        homeWith({
          ...appointment,
          appointmentStatus: 'ENTRY_REJECTED',
          washExecution: {
            washExecutionId: '44444444-4444-4444-4444-444444444444',
            status: 'ENTRY_REJECTED',
            rejectionReason: 'No cumple con los requisitos de ingreso.',
          },
        }),
      ),
    );

    const fixture = TestBed.createComponent(StudentWashHomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingreso rechazado');
    expect(fixture.nativeElement.textContent).toContain('No cumple con los requisitos de ingreso.');
  });
});
