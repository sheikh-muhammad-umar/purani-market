import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/models/user.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
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
  emailVerificationSent = signal(false);

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

  // MFA
  mfaLoading = signal(false);

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly http: HttpClient
  ) {
    this.emailForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
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
    this.emailChangeSuccess.set('');
    this.emailChangeError.set('');
    this.emailVerificationSent.set(false);
  }

  onEmailChangeSubmit(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.emailChanging.set(true);
    this.emailChangeError.set('');

    this.http
      .post<{ message: string }>(`${this.apiUrl}/auth/change-email`, {
        newEmail: this.emailForm.value.newEmail,
      })
      .subscribe({
        next: (res) => {
          this.emailChanging.set(false);
          this.emailVerificationSent.set(true);
          this.emailChangeSuccess.set(
            res.message || 'Verification link sent to your new email address.'
          );
        },
        error: (err) => {
          this.emailChanging.set(false);
          this.emailChangeError.set(
            err.error?.message || 'Failed to initiate email change.'
          );
        },
      });
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
      .post<{ message: string }>(`${this.apiUrl}/auth/change-phone`, {
        newPhone: this.phoneForm.value.newPhone,
      })
      .subscribe({
        next: (res) => {
          this.phoneChanging.set(false);
          this.phoneOtpSent.set(true);
          this.phoneChangeSuccess.set(
            res.message || 'OTP sent to your new phone number.'
          );
        },
        error: (err) => {
          this.phoneChanging.set(false);
          this.phoneChangeError.set(
            err.error?.message || 'Failed to initiate phone change.'
          );
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
      .post<{ message: string }>(`${this.apiUrl}/auth/change-phone/verify`, {
        otp: this.otpForm.value.otp,
      })
      .subscribe({
        next: (res) => {
          this.otpVerifying.set(false);
          this.phoneChangeSuccess.set(
            res.message || 'Phone number updated successfully.'
          );
          this.phoneOtpSent.set(false);
          this.showPhoneChange.set(false);
          this.loadUser();
        },
        error: (err) => {
          this.otpVerifying.set(false);
          this.phoneChangeError.set(
            err.error?.message || 'Invalid OTP. Please try again.'
          );
        },
      });
  }

  // --- MFA ---

  toggleMfa(): void {
    const currentUser = this.user();
    if (!currentUser) return;

    if (currentUser.mfa?.enabled) {
      // Disable MFA - in a real app this would require verification
      this.successMessage.set('MFA management requires additional verification.');
    } else {
      this.mfaLoading.set(true);
      this.authService.enableMfa().subscribe({
        next: () => {
          this.mfaLoading.set(false);
          this.successMessage.set('MFA setup initiated. Check your authenticator app.');
          this.loadUser();
        },
        error: (err) => {
          this.mfaLoading.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to enable MFA.');
        },
      });
    }
  }
}
