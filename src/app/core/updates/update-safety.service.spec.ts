import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppointmentRegistrationDraftService } from '../../features/wash-appointments/presentation/appointment-registration-draft.service';
import { UpdateSafetyService } from './update-safety.service';

describe('UpdateSafetyService', () => {
  let safety: UpdateSafetyService;
  const router = { url: '/wash/supervision' };
  const initial = {
    regulationAccepted: false,
    courseSectionId: '',
    instrumentCount: 15,
    appointmentType: 'NORMAL',
    pieceType: 'HIGH_SPEED',
  };
  let draft = { ...initial };
  let form: HTMLFormElement;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    router.url = '/wash/supervision';
    draft = { ...initial };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AppointmentRegistrationDraftService,
          useValue: { draft: () => draft, selectedTimeSlot: () => null },
        },
      ],
    });
    safety = TestBed.inject(UpdateSafetyService);
    form = document.createElement('form');
    document.body.append(form);
  });
  afterEach(() => {
    form.remove();
    sessionStorage.clear();
    localStorage.clear();
  });
  it('permits a safe home and login, never a workflow route', () => {
    expect(safety.reason()).toBeNull();
    router.url = '/wash/supervision/entry';
    expect(safety.reason()).toContain('vuelve al inicio');
    router.url = '/authentication/sign-in';
    expect(safety.reason()).toBeNull();
  });
  it('blocks active HTTP requests', () => {
    safety.requests.set(1);
    expect(safety.reason()).toContain('solicitudes en curso');
  });
  it('blocks all durable receipt formats, including another account and ambiguous results', () => {
    sessionStorage.setItem(
      'estoma.entry.receipts.v2',
      JSON.stringify([['other', { result: { status: 'EXPIRED' } }]]),
    );
    expect(safety.reason()).toContain('seguimiento');
    sessionStorage.removeItem('estoma.entry.receipts.v2');
    localStorage.setItem(
      'estoma.operational-resources.receipts.v1',
      JSON.stringify({ account: { key: 'pending' } }),
    );
    expect(safety.reason()).toContain('seguimiento');
  });
  it('fails closed when receipt storage is corrupt or inaccessible', () => {
    sessionStorage.setItem('estoma.booking.receipts.v1', 'broken');
    expect(safety.reason()).toContain('No pudimos comprobar');
    sessionStorage.clear();
    spyOn(Storage.prototype, 'getItem').and.throwError('denied');
    expect(safety.reason()).toContain('No pudimos comprobar');
  });
  it('protects a booking draft even after returning to home', () => {
    draft.regulationAccepted = true;
    expect(safety.reason()).toContain('cita en preparación');
  });
  it('protects dirty forms and autofilled input', () => {
    form.classList.add('ng-dirty');
    expect(safety.reason()).toContain('formulario');
    form.classList.remove('ng-dirty');
    const input = document.createElement('input');
    input.type = 'password';
    input.value = 'fixture';
    form.append(input);
    expect(safety.reason()).toContain('datos capturados');
  });
});
