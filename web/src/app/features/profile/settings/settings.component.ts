import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { User } from '../../../core/models/user.model';
import { UserStatus } from '../../../core/constants/enums';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ROUTES } from '../../../core/constants/routes';
import { API } from '../../../core/constants/api-endpoints';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppLoaderComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly UserStatus = UserStatus;
  user = signal<User | null>(null);
  loading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Email change
  showEmailChange = signal(false);
  emailForm: FormGroup;
  emailChanging = signal(false);
  emailChangeSuccess = signal('');
  emailChangeError = signal('');
  emailOtpSent = signal(false);
  emailOtpVerifying = signal(false);
  emailResendCooldown = signal(0);
  private emailCooldownTimer?: ReturnType<typeof setInterval>;

  // Phone change
  showPhoneChange = signal(false);
  phoneForm: FormGroup;
  phoneChanging = signal(false);
  phoneChangeSuccess = signal('');
  phoneChangeError = signal('');
  phoneOtpSent = signal(false);

  // OTP verification for phone
  otpForm: FormGroup;
  otpVerifying = signal(false);

  // OTP verification for email
  emailOtpForm: FormGroup;

  // MFA
  mfaLoading = signal(false);

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    public readonly themeService: ThemeService,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.emailForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
    });

    this.emailOtpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.phoneForm = this.fb.group({
      newPhone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.loadUser();

    // The MFA screen redirects back here after enabling or disabling; without
    // this the toggle silently flips and the user gets no confirmation.
    const mfaResult = this.route.snapshot.queryParamMap.get('mfa');
    if (mfaResult === 'enabled') {
      this.successMessage.set('Two-factor authentication is on.');
    } else if (mfaResult === 'disabled') {
      this.successMessage.set('Two-factor authentication is off.');
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.emailCooldownTimer);
  }

  loadUser(): void {
    this.loading.set(true);
    this.authService.fetchCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load account settings.');
        this.loading.set(false);
      },
    });
  }

  // --- Email Change ---

  toggleEmailChange(): void {
    this.showEmailChange.update((v) => !v);
    this.emailForm.reset();
    this.emailOtpForm.reset();
    this.emailChangeSuccess.set('');
    this.emailChangeError.set('');
    this.emailOtpSent.set(false);
    clearInterval(this.emailCooldownTimer);
    this.emailResendCooldown.set(0);
  }

  onEmailChangeSubmit(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.emailChanging.set(true);
    this.emailChangeError.set('');

    const newEmail: string = this.emailForm.value.newEmail;

    this.authService.sendEmailOtp(newEmail).subscribe({
      next: () => {
        this.emailChanging.set(false);
        this.emailOtpSent.set(true);
        this.emailChangeSuccess.set(`Verification code sent to ${newEmail}`);
        this.startEmailCooldown(60);
      },
      error: (err) => {
        this.emailChanging.set(false);
        const isConflict = err?.status === 409;
        this.emailChangeError.set(
          isConflict
            ? 'This email is already in use by another account.'
            : 'Failed to send verification code. Please try again.',
        );
      },
    });
  }

  resendEmailCode(): void {
    if (this.emailResendCooldown() > 0 || this.emailChanging()) return;
    this.emailChanging.set(true);
    this.emailChangeError.set('');
    this.emailChangeSuccess.set('');

    const newEmail: string = this.emailForm.value.newEmail;

    this.authService.sendEmailOtp(newEmail).subscribe({
      next: () => {
        this.emailChanging.set(false);
        this.emailChangeSuccess.set(`Code resent to ${newEmail}`);
        this.startEmailCooldown(60);
      },
      error: () => {
        this.emailChanging.set(false);
        this.emailChangeError.set('Failed to resend code. Please try again.');
      },
    });
  }

  onEmailOtpVerifySubmit(): void {
    if (this.emailOtpForm.invalid) {
      this.emailOtpForm.markAllAsTouched();
      return;
    }

    this.emailOtpVerifying.set(true);
    this.emailChangeError.set('');

    this.authService.verifyEmailOtp(this.emailOtpForm.value.otp).subscribe({
      next: () => {
        this.emailOtpVerifying.set(false);
        this.emailChangeSuccess.set('Email updated and verified successfully.');
        this.emailOtpSent.set(false);
        this.showEmailChange.set(false);
        clearInterval(this.emailCooldownTimer);
        this.emailResendCooldown.set(0);
        // Invalidate cache so the next fetch hits the API and updates
        // the global authService.user() signal used by the header etc.
        this.authService.invalidateUserCache();
        this.authService.fetchCurrentUser().subscribe({
          next: (user) => this.user.set(user),
        });
      },
      error: () => {
        this.emailOtpVerifying.set(false);
        this.emailChangeError.set('Invalid code. Please try again.');
      },
    });
  }

  private startEmailCooldown(seconds: number): void {
    this.emailResendCooldown.set(seconds);
    clearInterval(this.emailCooldownTimer);
    this.emailCooldownTimer = setInterval(() => {
      const remaining = this.emailResendCooldown() - 1;
      if (remaining <= 0) {
        clearInterval(this.emailCooldownTimer);
        this.emailResendCooldown.set(0);
      } else {
        this.emailResendCooldown.set(remaining);
      }
    }, 1000);
  }

  // --- Phone Change ---

  togglePhoneChange(): void {
    this.showPhoneChange.update((v) => !v);
    this.phoneForm.reset();
    this.otpForm.reset();
    this.phoneChangeSuccess.set('');
    this.phoneChangeError.set('');
    this.phoneOtpSent.set(false);
  }

  onPhoneChangeSubmit(): void {
    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    this.phoneChanging.set(true);
    this.phoneChangeError.set('');

    this.http
      .post<{ message: string }>(`${this.apiUrl}${API.AUTH_CHANGE_PHONE}`, {
        newPhone: this.phoneForm.value.newPhone,
      })
      .subscribe({
        next: (res) => {
          this.phoneChanging.set(false);
          this.phoneOtpSent.set(true);
          this.phoneChangeSuccess.set(res.message || 'OTP sent to your new phone number.');
        },
        error: () => {
          this.phoneChanging.set(false);
          this.phoneChangeError.set('Failed to initiate phone change.');
        },
      });
  }

  onOtpVerifySubmit(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.otpVerifying.set(true);
    this.phoneChangeError.set('');

    this.http
      .post<{ message: string }>(`${this.apiUrl}${API.AUTH_CHANGE_PHONE_VERIFY}`, {
        otp: this.otpForm.value.otp,
      })
      .subscribe({
        next: (res) => {
          this.otpVerifying.set(false);
          this.phoneChangeSuccess.set(res.message || 'Phone number updated successfully.');
          this.phoneOtpSent.set(false);
          this.showPhoneChange.set(false);
          this.authService.invalidateUserCache();
          this.authService.fetchCurrentUser().subscribe({
            next: (user) => this.user.set(user),
          });
        },
        error: () => {
          this.otpVerifying.set(false);
          this.phoneChangeError.set('Invalid OTP. Please try again.');
        },
      });
  }

  // --- MFA ---

  /**
   * Hands off to the MFA screen for both directions.
   *
   * Enabling used to call the API straight from here, which returned the QR code
   * into a discarded response and left the user told that "setup initiated" with
   * nothing to scan. Disabling only ever printed a message. Both now go to the
   * screen that can actually show a QR code and collect a password.
   */
  toggleMfa(): void {
    const currentUser = this.user();
    if (!currentUser) return;

    void this.router.navigate([ROUTES.AUTH_MFA], {
      queryParams: currentUser.mfa?.enabled ? { disable: 'true' } : { setup: 'true' },
    });
  }
}
