import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService, AuthTokens } from '../../../core/auth/auth.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { LOGIN_METHOD_EMAIL, LOGIN_METHOD_PHONE } from '../../../core/constants/app';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly ROUTES = ROUTES;
  loginForm: FormGroup;
  usePhone = signal(false);
  loading = signal(false);
  errorMessage = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly tracker: ActivityTrackerService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  toggleLoginMethod(): void {
    this.usePhone.update((v) => !v);
    this.loginForm.reset();
    this.errorMessage.set('');
    if (this.usePhone()) {
      this.loginForm.get('email')?.clearValidators();
      this.loginForm
        .get('phone')
        ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    } else {
      this.loginForm.get('phone')?.clearValidators();
      this.loginForm.get('email')?.setValidators([Validators.required, Validators.email]);
    }
    this.loginForm.get('email')?.updateValueAndValidity();
    this.loginForm.get('phone')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const credentials = this.usePhone()
      ? { phone: this.loginForm.value.phone, password: this.loginForm.value.password }
      : { email: this.loginForm.value.email, password: this.loginForm.value.password };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (this.authService.isMfaResponse(response)) {
          this.router.navigate([ROUTES.AUTH_MFA], {
            queryParams: { token: response.mfaToken },
          });
        } else {
          this.authService.storeTokens(response as AuthTokens);
          this.authService.fetchCurrentUser().subscribe(() => {
            this.tracker.trackLoginWithLocation({
              method: this.usePhone() ? LOGIN_METHOD_PHONE : LOGIN_METHOD_EMAIL,
              ...this.tracker.getDeviceInfo(),
            });
            this.router.navigate([ROUTES.HOME]);
          });
        }
      },
      error: (err) => {
        this.loading.set(false);
        const message = err.error?.message || 'Invalid credentials. Please try again.';
        this.errorMessage.set(message);
        this.tracker.trackAnonymous(TrackingEvent.LOGIN_FAILED, {
          method: this.usePhone() ? LOGIN_METHOD_PHONE : LOGIN_METHOD_EMAIL,
          identifier: this.usePhone() ? this.loginForm.value.phone : this.loginForm.value.email,
          errorMessage: message,
          statusCode: err.status,
          ...this.tracker.getDeviceInfo(),
          timestamp: new Date().toISOString(),
        });
      },
    });
  }

  onSocialLogin(provider: 'google' | 'facebook'): void {
    // In a real app, this would open an OAuth popup/redirect
    // For now, we show a placeholder message
    this.errorMessage.set(`${provider} login integration requires OAuth setup.`);
  }
}
