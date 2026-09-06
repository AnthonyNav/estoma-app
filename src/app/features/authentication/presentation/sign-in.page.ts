import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ApplicationError } from '../../../core/api/application-error';
import { SignInUseCase } from '../application/sign-in.use-case';
import { AuthSessionService } from '../application/auth-session.service';
import { authMessage } from '../application/auth-messages';
@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage implements OnDestroy {
  private readonly auth = inject(AuthSessionService);
  private readonly signIn = inject(SignInUseCase);
  readonly selectedSystem = this.auth.store.selectedSystemCode;
  readonly notice = this.auth.store.notice;
  readonly showPassword = signal(false);
  readonly form = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [
        (control: AbstractControl) =>
          typeof control.value === 'string' && control.value.trim() ? null : { required: true },
      ],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly error = signal<string | null>(null);
  readonly traceId = signal<string | null>(null);
  readonly submitting = signal(false);
  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }
  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.traceId.set(null);
    this.submitting.set(true);
    this.auth.store.notice.set(null);
    const command = this.form.getRawValue();
    this.form.disable();
    try {
      await this.signIn.execute(command);
      this.form.controls.password.reset();
      this.showPassword.set(false);
      await this.auth.continueAfterLogin();
    } catch (error) {
      this.error.set(authMessage(error));
      this.traceId.set(error instanceof ApplicationError ? (error.traceId ?? null) : null);
    } finally {
      command.password = '';
      this.form.enable();
      this.submitting.set(false);
    }
  }
  ngOnDestroy(): void {
    this.form.controls.password.reset();
  }
}
