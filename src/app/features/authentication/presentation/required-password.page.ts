import {
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  Component,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthSessionService } from '../application/auth-session.service';
import { authMessage } from '../application/auth-messages';
import { ApplicationError } from '../../../core/api/application-error';
@Component({
  selector: 'app-required-password',
  imports: [ReactiveFormsModule],
  templateUrl: './required-password.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequiredPasswordPage implements OnDestroy {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  constructor() {
    afterNextRender(() =>
      this.element.nativeElement.querySelector<HTMLElement>('#password-title')?.focus(),
    );
  }
  readonly auth = inject(AuthSessionService);
  readonly visible = signal(false);
  readonly confirmingVisible = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly traceId = signal<string | null>(null);
  readonly form = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(15), Validators.maxLength(128)],
      }),
      confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    {
      validators: [
        (control: AbstractControl) =>
          control.get('newPassword')?.value === control.get('confirmation')?.value
            ? null
            : { mismatch: true },
      ],
    },
  );
  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.traceId.set(null);
    let password = this.form.controls.newPassword.value;
    this.form.disable();
    try {
      await this.auth.changeRequiredPassword(password);
      this.form.reset();
      await this.auth.continueAfterLogin();
    } catch (error) {
      this.error.set(authMessage(error, 'password'));
      this.traceId.set(error instanceof ApplicationError ? (error.traceId ?? null) : null);
    } finally {
      password = '';
      this.form.enable();
      this.submitting.set(false);
    }
  }
  ngOnDestroy(): void {
    this.form.reset();
  }
}
