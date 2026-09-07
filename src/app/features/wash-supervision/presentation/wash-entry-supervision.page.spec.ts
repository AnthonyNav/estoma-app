import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { WashEntrySupervisionPage } from './wash-entry-supervision.page';

describe('Supervisor entry decision interaction', () => {
  let decide: jasmine.Spy;
  let canDecide: ReturnType<typeof signal<boolean>>;
  beforeEach(() => {
    decide = jasmine.createSpy('decide');
    canDecide = signal(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { getCurrentNavigation: () => null } },
        {
          provide: SupervisorEntryWorkflowService,
          useValue: {
            canDecide,
            canStartDecision: canDecide,
            decide,
            lookup: signal(null),
            canArrive: signal(false),
          },
        },
      ],
    }).overrideComponent(WashEntrySupervisionPage, { set: { template: '', imports: [] } });
  });
  it('never registers arrival when a student is only consulted', () => {
    const lookup = signal({ appointment: { appointmentId: 'test' } });
    const canArrive = signal(true);
    const arrive = jasmine.createSpy('arrive');
    TestBed.overrideProvider(SupervisorEntryWorkflowService, {
      useValue: { lookup, canArrive, arrive },
    });
    const fixture = TestBed.createComponent(WashEntrySupervisionPage);
    fixture.detectChanges();
    expect(arrive).not.toHaveBeenCalled();
    canArrive.set(false);
    fixture.detectChanges();
    canArrive.set(true);
    fixture.detectChanges();
    expect(arrive).not.toHaveBeenCalled();
  });
  it('does not register arrivals for an ineligible or already active appointment', () => {
    const arrive = jasmine.createSpy('arrive');
    TestBed.overrideProvider(SupervisorEntryWorkflowService, {
      useValue: {
        lookup: signal({ appointment: { appointmentId: 'test' } }),
        canArrive: signal(false),
        arrive,
      },
    });
    const fixture = TestBed.createComponent(WashEntrySupervisionPage);
    fixture.detectChanges();
    expect(arrive).not.toHaveBeenCalled();
  });
  it('clears the completed student before opening the next scanner', () => {
    const reset = jasmine.createSpy('reset');
    const navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.overrideProvider(Router, { useValue: { getCurrentNavigation: () => null, navigate } });
    TestBed.overrideProvider(SupervisorEntryWorkflowService, {
      useValue: {
        lookup: signal({ washExecution: { status: 'IN_PROGRESS' } }),
        pending: signal(null),
        busy: signal(false),
        reset,
      },
    });
    const page = TestBed.createComponent(WashEntrySupervisionPage).componentInstance;
    page.finishAttention('scan');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledOnceWith(['/wash/supervision/scan']);
  });
  it('does not abandon an unresolved operation to scan another student', () => {
    const reset = jasmine.createSpy('reset');
    TestBed.overrideProvider(SupervisorEntryWorkflowService, {
      useValue: {
        pending: signal({ operationId: 'pending' }),
        resume: jasmine.createSpy('resume'),
        busy: signal(false),
        reset,
      },
    });
    const page = TestBed.createComponent(WashEntrySupervisionPage).componentInstance;
    page.finishAttention('scan');
    expect(reset).not.toHaveBeenCalled();
  });
  it('approves with both confirmations without checkboxes', () => {
    const page = TestBed.createComponent(WashEntrySupervisionPage).componentInstance;
    page.openDecision('AUTHORIZED', new MouseEvent('click'));
    expect(decide).toHaveBeenCalledOnceWith('AUTHORIZED', true, true, '');
  });
  it('rejects with only the written reason and no positive confirmations', () => {
    const page = TestBed.createComponent(WashEntrySupervisionPage).componentInstance;
    page.openDecision('REJECTED', new MouseEvent('click'));
    page.rejectionReason.set('  Falta protección auditiva  ');
    page.confirmDecision();
    expect(decide).toHaveBeenCalledOnceWith('REJECTED', false, false, 'Falta protección auditiva');
  });
  it('requires a valid reason and rechecks eligibility before submitting', () => {
    const page = TestBed.createComponent(WashEntrySupervisionPage).componentInstance;
    page.openDecision('REJECTED', new MouseEvent('click'));
    page.rejectionReason.set('  ');
    page.confirmDecision();
    expect(decide).not.toHaveBeenCalled();
    page.rejectionReason.set('x'.repeat(501));
    page.confirmDecision();
    expect(decide).not.toHaveBeenCalled();
    page.rejectionReason.set('Motivo');
    canDecide.set(false);
    page.confirmDecision();
    page.openDecision('AUTHORIZED', new MouseEvent('click'));
    expect(decide).not.toHaveBeenCalled();
  });
});
