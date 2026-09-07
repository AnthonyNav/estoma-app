import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { SupervisorScannerPage } from './supervisor-scanner.page';

describe('Supervisor camera lifecycle', () => {
  let search: jasmine.Spy;
  let navigate: jasmine.Spy;
  beforeEach(() => {
    search = jasmine.createSpy('search');
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        {
          provide: SupervisorEntryWorkflowService,
          useValue: { pending: signal(null), busy: signal(false), search },
        },
      ],
    }).overrideComponent(SupervisorScannerPage, { set: { template: '', imports: [] } });
  });
  it('stops a late camera permission grant after leaving the page', async () => {
    let grant!: (stream: MediaStream) => void;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
      new Promise((resolve) => (grant = resolve)),
    );
    const fixture = TestBed.createComponent(SupervisorScannerPage);
    const opening = fixture.componentInstance.start();
    fixture.destroy();
    const stop = jasmine.createSpy('stop');
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await opening;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();
  });
  it('explains denied permission without starting lookup', async () => {
    spyOn(navigator.mediaDevices, 'getUserMedia').and.rejectWith(
      new DOMException('denied', 'NotAllowedError'),
    );
    const fixture = TestBed.createComponent(SupervisorScannerPage);
    await fixture.componentInstance.start();
    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.error()).toContain('permiso');
    expect(search).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('reads an opaque value once, never follows QR URLs, and clears video on stop', () => {
    const fixture = TestBed.createComponent(SupervisorScannerPage);
    const page = fixture.componentInstance;
    page.camera = new ElementRef(document.createElement('video'));
    page.state.set('scanning');
    page.detected('https://example.invalid/opaque');
    page.detected('https://example.invalid/opaque');
    expect(search).toHaveBeenCalledOnceWith({
      lookupType: 'QR',
      qrRepresentation: 'https://example.invalid/opaque',
    });
    expect(navigate).toHaveBeenCalledOnceWith(['/wash/supervision/entry'], {
      state: { from: 'scan' },
    });
    expect(page.camera.nativeElement.srcObject).toBeNull();
    fixture.destroy();
  });
});
