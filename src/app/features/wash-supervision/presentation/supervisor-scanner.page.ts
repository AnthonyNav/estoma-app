import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';

@Component({
  selector: 'app-supervisor-scanner-page',
  imports: [RouterLink],
  templateUrl: './supervisor-scanner.page.html',
  styleUrl: './supervisor-scanner.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorScannerPage {
  readonly flow = inject(SupervisorEntryWorkflowService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('camera', { static: true }) camera!: ElementRef<HTMLVideoElement>;
  readonly state = signal<'idle' | 'opening' | 'scanning' | 'error' | 'detected'>('idle');
  readonly error = signal('');
  private stream: MediaStream | null = null;
  private timeout?: ReturnType<typeof setTimeout>;
  private generation = 0;
  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
    inject(SessionLifecycleService)
      .ended$.pipe(takeUntilDestroyed())
      .subscribe(() => this.stop());
  }
  async start(): Promise<void> {
    if (
      ['opening', 'scanning', 'detected'].includes(this.state()) ||
      this.flow.pending() ||
      this.flow.busy()
    )
      return;
    this.error.set('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        'Para usar la cámara, abre esta página con HTTPS y un certificado de confianza. También puedes buscar por matrícula.',
      );
      this.state.set('error');
      return;
    }
    const generation = ++this.generation;
    this.state.set('opening');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (generation !== this.generation || this.destroyRef.destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener(
          'ended',
          () => {
            if (generation !== this.generation) return;
            this.stop();
            this.error.set('La cámara se desconectó. Puedes volver a activarla.');
            this.state.set('error');
          },
          { once: true },
        ),
      );
      const video = this.camera.nativeElement;
      video.srcObject = stream;
      await video.play();
      const { default: decode } = await import('jsqr');
      if (generation !== this.generation) return;
      this.state.set('scanning');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('CanvasUnavailable');
      const scan = () => {
        if (generation !== this.generation) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = decode(pixels.data, canvas.width, canvas.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (result?.data) {
              this.detected(result.data);
              return;
            }
          }
          this.timeout = setTimeout(scan, 250);
        } catch {
          this.stop();
          this.error.set(
            'No pudimos leer la imagen. Activa la cámara nuevamente o busca por matrícula.',
          );
          this.state.set('error');
        }
      };
      scan();
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const name = error instanceof DOMException ? error.name : '';
      this.error.set(
        name === 'NotAllowedError'
          ? 'No se permitió el acceso a la cámara. Revisa el permiso del sitio en tu navegador y vuelve a intentarlo.'
          : name === 'NotFoundError'
            ? 'No encontramos una cámara disponible en este dispositivo.'
            : name === 'NotReadableError'
              ? 'La cámara está ocupada. Cierra otras aplicaciones que la estén usando y vuelve a intentarlo.'
              : 'No pudimos iniciar la cámara. Intenta nuevamente o busca por matrícula.',
      );
      this.state.set('error');
    }
  }
  detected(value: string): void {
    if (this.state() !== 'scanning') return;
    this.stop();
    if (!value.trim() || value.length > 2000) {
      this.error.set(
        'Este código no tiene un formato válido para consultar la cita. Intenta con el QR del alumno.',
      );
      this.state.set('error');
      return;
    }
    this.state.set('detected');
    this.flow.search({ lookupType: 'QR', qrRepresentation: value });
    void this.router.navigate(['/wash/supervision/entry'], { state: { from: 'scan' } });
  }
  stop(): void {
    this.generation++;
    clearTimeout(this.timeout);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.camera) this.camera.nativeElement.srcObject = null;
    this.state.set('idle');
  }
  @HostListener('window:pagehide') pageHidden(): void {
    this.stop();
  }
  @HostListener('document:visibilitychange') visibilityChanged(): void {
    if (document.hidden) this.stop();
  }
  manual(): void {
    this.stop();
    this.flow.reset();
  }
}
