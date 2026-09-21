import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  OperationalResourcesService,
  OperationalResource,
} from '../application/operational-resources.service';
import { OperationalResourcesPage } from './operational-resources.page';

describe('OperationalResourcesPage presentation', () => {
  const resource: OperationalResource = {
    resourceId: 'cabin-1',
    resourceType: 'CABIN',
    code: 'C1',
    name: 'Cabina uno',
    administrativeStatus: 'ACTIVE',
    unavailabilities: [],
  };
  function setup() {
    const flow = {
      load: jasmine.createSpy('load').and.resolveTo(),
      resources: signal([resource]),
      loaded: signal(true),
      busy: signal(false),
      pending: signal<unknown>(null),
      message: signal(''),
      start: jasmine.createSpy('start'),
      resume: jasmine.createSpy('resume'),
    };
    TestBed.configureTestingModule({
      imports: [OperationalResourcesPage],
      providers: [provideRouter([]), { provide: OperationalResourcesService, useValue: flow }],
    });
    const fixture = TestBed.createComponent(OperationalResourcesPage);
    return { fixture, flow };
  }
  it('translates administrative states and does not imply that a resource is unoccupied', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Estado administrativo: Activa');
    expect(fixture.nativeElement.textContent).toContain('Sin inhabilitaciones');
    expect(fixture.componentInstance.administrativeLabel('FUTURE')).toBe('Por verificar');
  });
  it('keeps the reason form beside its resource and blocks empty submissions', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.componentInstance.select(resource);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('article.resource');
    expect(card.querySelector('textarea')).not.toBeNull();
    expect(card.querySelector('button[type="submit"]').disabled).toBeTrue();
  });
  it('retains pending receipt recovery and disables resource changes', async () => {
    const { fixture, flow } = setup();
    await fixture.whenStable();
    flow.pending.set({ label: 'Cabina uno' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('aside').textContent).toContain(
      'Solicitud en seguimiento',
    );
    expect(fixture.nativeElement.querySelector('.resource-action button').disabled).toBeTrue();
    fixture.nativeElement.querySelector('aside button').click();
    expect(flow.resume).toHaveBeenCalled();
  });
});
