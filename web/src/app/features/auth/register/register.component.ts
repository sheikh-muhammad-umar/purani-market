import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { SocialProvider } from '../../../core/enums/social-provider';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { LOGIN_METHOD_EMAIL, LOGIN_METHOD_PHONE } from '../../../core/constants/app';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  readonly ROUTES = ROUTES;
  readonly SocialProvider = SocialProvider;

  registerForm: FormGroup;
  usePhone = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly tracker: ActivityTrackerService,
    private readonly socialAuth: SocialAuthService,
  ) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.maxLength(50)]],
        lastName: ['', [Validators.required, Validators.maxLength(50)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  toggleRegistrationMethod(): void {
    this.usePhone.update((v) => !v);
    this.registerForm.get('email')?.reset();
    this.registerForm.get('phone')?.reset();
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.usePhone()) {
      this.registerForm.get('email')?.clearValidators();
      this.registerForm
        .get('phone')
        ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    } else {
      this.registerForm.get('phone')?.clearValidators();
      this.registerForm.get('email')?.setValidators([Validators.required, Validators.email]);
    }
    this.registerForm.get('email')?.updateValueAndValidity();
    this.registerForm.get('phone')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.registerForm.value;
    const data = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      password: formValue.password,
      ...(this.usePhone() ? { phone: formValue.phone } : { email: formValue.email }),
    };

    this.authService
      .register(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          this.successMessage.set(
            response.message ||
              (this.usePhone()
                ? 'Registration successful! Please verify your phone number.'
                : 'Registration successful! Please check your email for verification.'),
          );
          this.tracker.trackAnonymous(TrackingEvent.REGISTER, {
            method: this.usePhone() ? LOGIN_METHOD_PHONE : LOGIN_METHOD_EMAIL,
            ...this.tracker.getDeviceInfo(),
          });
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err.error?.message || 'Registration failed. Please try again.');
        },
      });
  }

  onSocialLogin(provider: SocialProvider): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const signIn =
      provider === SocialProvider.GOOGLE
        ? this.socialAuth.signInWithGoogle()
        : provider === SocialProvider.FACEBOOK
          ? this.socialAuth.signInWithFacebook()
          : this.socialAuth.signInWithApple();

    signIn
      .then((socialToken) => {
        this.authService
          .socialLogin(
            socialToken.provider,
            socialToken.token,
            socialToken.firstName,
            socialToken.lastName,
          )
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (tokens) => {
              this.loading.set(false);
              this.authService.storeTokens(tokens);
              this.authService
                .fetchCurrentUser()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(() => {
                  this.tracker.track(TrackingEvent.SOCIAL_LOGIN, {
                    metadata: { provider },
                  });
                  this.router.navigate([ROUTES.HOME]);
                });
            },
            error: (err) => {
              this.loading.set(false);
              this.errorMessage.set(
                err.error?.message || `${provider} sign-up failed. Please try again.`,
              );
            },
          });
      })
      .catch(() => {
        this.loading.set(false);
      });
  }
}
