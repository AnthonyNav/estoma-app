import { ChangeDetectionStrategy, Component, Input, OnChanges, signal } from '@angular/core';
import { toDataURL } from 'qrcode';

@Component({
  selector: 'app-appointment-qr',
  templateUrl: './appointment-qr.component.html',
  styleUrl: './appointment-qr.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentQrComponent implements OnChanges {
  @Input({ required: true }) qrRepresentation = '';
  @Input() size: 'compact' | 'large' = 'compact';

  readonly imageUrl = signal<string | null>(null);
  readonly unavailable = signal(false);
  private requestId = 0;

  ngOnChanges(): void {
    void this.renderQr(this.qrRepresentation);
  }

  private async renderQr(representation: string): Promise<void> {
    const requestId = ++this.requestId;
    this.imageUrl.set(null);
    this.unavailable.set(false);

    try {
      const imageUrl = await toDataURL(representation, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#004352',
          light: '#ffffffff',
        },
      });

      if (requestId === this.requestId) {
        this.imageUrl.set(imageUrl);
      }
    } catch {
      if (requestId === this.requestId) {
        this.unavailable.set(true);
      }
    }
  }
}
