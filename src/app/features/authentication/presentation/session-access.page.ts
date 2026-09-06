import {
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '../application/auth-session.service';
import { authMessage } from '../application/auth-messages';
import { SYSTEM_LABELS, SystemCode } from '../domain/models/session';
import { ApplicationError } from '../../../core/api/application-error';
@Component({
  selector: 'app-session-access',
  templateUrl: './session-access.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionAccessPage implements OnInit {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  constructor() {
    afterNextRender(() =>
      this.element.nativeElement.querySelector<HTMLElement>('#access-title')?.focus(),
    );
  }
  readonly auth = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly traceId = signal<string | null>(null);
  readonly labels = SYSTEM_LABELS;
  readonly systems = Object.keys(SYSTEM_LABELS) as SystemCode[];
  readonly context = this.route.snapshot.data['context'] === true;
  readonly choose = this.route.snapshot.queryParamMap.has('choose');
  ngOnInit(): void {
    const error = this.auth.store.profileLoadError();
    this.auth.store.profileLoadError.set(null);
    if (error) {
      this.error.set(authMessage(error, 'profile'));
      this.traceId.set(error instanceof ApplicationError ? (error.traceId ?? null) : null);
      return;
    }
    void this.load();
  }
  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.traceId.set(null);
    try {
      const profile = await this.auth.loadProfile();
      if (!this.auth.store.session()) return;
      const selected = this.auth.store.selectedSystemCode();
      if (this.context && !profile.availableSystemCodes.includes(selected))
        await this.router.navigate(['/authentication/access']);
      else if (!this.context && !this.choose && profile.availableSystemCodes.includes(selected))
        await this.auth.enterSystem(selected);
    } catch (error) {
      this.error.set(authMessage(error, 'profile'));
      this.traceId.set(error instanceof ApplicationError ? (error.traceId ?? null) : null);
    } finally {
      this.loading.set(false);
    }
  }
}
