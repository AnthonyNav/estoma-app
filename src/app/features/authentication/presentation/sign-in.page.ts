import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SignInUseCase } from '../application/sign-in.use-case';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly signIn = inject(SignInUseCase);
  readonly form = new FormGroup({
    identifier: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly error = signal<string | null>(null);
  readonly signedInAs = signal<string | null>(null);
  readonly submitting = signal(false);

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    this.signIn.execute(this.form.getRawValue()).subscribe({
      next: (session) => {
        this.signedInAs.set(session.accountId);
        this.submitting.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.submitting.set(false);
      },
    });
  }
}
