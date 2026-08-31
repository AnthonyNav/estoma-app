import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { SignInUseCase } from '../application/sign-in.use-case';
import { SessionStoreService } from '../application/session-store.service';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly signIn = inject(SignInUseCase);
  private readonly sessionStore = inject(SessionStoreService);
  private readonly router = inject(Router);
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
        this.sessionStore.set(session);
        this.signedInAs.set(session.accountId);
        this.submitting.set(false);
        void this.router.navigate(['/wash/student']);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.submitting.set(false);
      },
    });
  }
}
