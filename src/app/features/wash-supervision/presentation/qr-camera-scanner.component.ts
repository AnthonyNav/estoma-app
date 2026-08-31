import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

type ScannerState = 'IDLE' | 'REQUESTING' | 'SCANNING' | 'ERROR';

@Component({
  selector: 'app-wash-qr-camera-scanner',
  templateUrl: './qr-camera-scanner.component.html',
  styleUrl: './qr-camera-scanner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCameraScannerComponent implements OnDestroy {
  @ViewChild('preview') private preview?: ElementRef<HTMLVideoElement>;

  readonly disabled = input(false);
  readonly scanned = output<string>();
  readonly state = signal<ScannerState>('IDLE');
  readonly error = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private detector: BarcodeDetectorInstance | null = null;
  private animationFrame: number | null = null;
  private scanSession = 0;

  private readonly stopWhenDisabled = effect(() => {
    if (this.disabled()) {
      this.stop();
    }
  });

  async start(): Promise<void> {
    if (this.disabled() || this.state() === 'REQUESTING' || this.state() === 'SCANNING') {
      return;
    }

    const scanSession = ++this.scanSession;
    const BarcodeDetector = this.getBarcodeDetector();
    if (!BarcodeDetector) {
      this.error.set(
        'Este navegador no puede leer códigos QR con la cámara. Usa la búsqueda manual.',
      );
      this.state.set('ERROR');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('No es posible abrir la cámara en este dispositivo. Usa la búsqueda manual.');
      this.state.set('ERROR');
      return;
    }

    this.error.set(null);
    this.state.set('REQUESTING');

    // El elemento <video> se muestra al cambiar el estado anterior.
    await new Promise<void>((resolve) => window.setTimeout(resolve));
    if (!this.isCurrentSession(scanSession)) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      if (!this.isCurrentSession(scanSession) || this.disabled()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      const video = this.preview?.nativeElement;
      if (!video) {
        throw new Error('No se pudo iniciar la vista de la cámara.');
      }

      video.srcObject = this.stream;
      await video.play();
      if (!this.isCurrentSession(scanSession) || this.disabled()) {
        this.releaseCamera();
        return;
      }
      this.detector = new BarcodeDetector({ formats: ['qr_code'] });
      this.state.set('SCANNING');
      this.readNextFrame(scanSession);
    } catch (error: unknown) {
      if (!this.isCurrentSession(scanSession)) {
        return;
      }
      this.releaseCamera();
      this.error.set(this.cameraErrorMessage(error));
      this.state.set('ERROR');
    }
  }

  stop(): void {
    this.scanSession += 1;
    this.releaseCamera();
    this.error.set(null);
    this.state.set('IDLE');
  }

  ngOnDestroy(): void {
    this.scanSession += 1;
    this.releaseCamera();
  }

  private readNextFrame(scanSession: number): void {
    const video = this.preview?.nativeElement;
    if (
      !video ||
      !this.detector ||
      !this.isCurrentSession(scanSession) ||
      this.state() !== 'SCANNING'
    ) {
      return;
    }

    void this.detector
      .detect(video)
      .then((codes) => {
        if (!this.isCurrentSession(scanSession)) {
          return;
        }
        const value = codes.find((code) => code.rawValue.trim())?.rawValue.trim();
        if (value) {
          this.scanSession += 1;
          this.releaseCamera();
          this.state.set('IDLE');
          this.scanned.emit(value);
          return;
        }

        this.animationFrame = requestAnimationFrame(() => this.readNextFrame(scanSession));
      })
      .catch(() => {
        if (!this.isCurrentSession(scanSession)) {
          return;
        }
        this.scanSession += 1;
        this.releaseCamera();
        this.error.set(
          'No fue posible leer el código QR. Intenta nuevamente o usa la búsqueda manual.',
        );
        this.state.set('ERROR');
      });
  }

  private releaseCamera(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.preview?.nativeElement.pause();
    if (this.preview) {
      this.preview.nativeElement.srcObject = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.detector = null;
  }

  private getBarcodeDetector(): BarcodeDetectorConstructor | null {
    return (
      (globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector ?? null
    );
  }

  private isCurrentSession(scanSession: number): boolean {
    return scanSession === this.scanSession;
  }

  private cameraErrorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'Se necesita permiso para usar la cámara. Autorízalo o usa la búsqueda manual.';
    }
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return 'No encontramos una cámara disponible. Usa la búsqueda manual.';
    }
    return 'No fue posible abrir la cámara. Intenta nuevamente o usa la búsqueda manual.';
  }
}
