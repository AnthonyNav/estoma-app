import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrCameraScannerComponent } from './qr-camera-scanner.component';

describe('QrCameraScannerComponent', () => {
  let fixture: ComponentFixture<QrCameraScannerComponent>;
  let component: QrCameraScannerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCameraScannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QrCameraScannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the manual fallback when QR camera decoding is unavailable', async () => {
    const barcodeDetector = Object.getOwnPropertyDescriptor(globalThis, 'BarcodeDetector');
    Object.defineProperty(globalThis, 'BarcodeDetector', {
      configurable: true,
      value: undefined,
    });

    try {
      await component.start();

      expect(component.state()).toBe('ERROR');
      expect(component.error()).toContain('búsqueda manual');
    } finally {
      if (barcodeDetector) {
        Object.defineProperty(globalThis, 'BarcodeDetector', barcodeDetector);
      } else {
        Reflect.deleteProperty(globalThis, 'BarcodeDetector');
      }
    }
  });

  it('does not request the camera while the parent action is disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    await component.start();

    expect(component.state()).toBe('IDLE');
    expect(component.error()).toBeNull();
  });
});
