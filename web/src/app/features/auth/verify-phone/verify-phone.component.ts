import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { OtpChannel } from '../../../core/enums/otp-channel';
import { ROUTES } from '../../../core/constants/routes';

const OTP_PATTERN = /^\d{6}$/;

@Component({
  selector: 'app-verify-phone',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './verify-phone.component.html',
  styleUrl: './verify-phone.component.scss',
})
export class VerifyPhoneComponent {
  readonly ROUTES = ROUTES;
  verifyForm: FormGroup;
  loading = signal(false);
  success = signal(false);
  errorMessage = signal('');
  resendLoading = signal(false);
  resendSuccess = signal(false);
  phone: string;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly tracker: ActivityTrackerService,
  ) {
    this.phone = this.route.snapshot.queryParamMap.get('phone') || '';
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(OTP_PATTERN)]],
    });
  }

  onSubmit(): void {
    if (this.verifyForm.invalid || !this.phone) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService
      .verifyPhone(this.phone, this.verifyForm.value.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
          this.tracker.track(TrackingEvent.PHONE_VERIFIED);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err.error?.message || 'Invalid or expired verification code.');
          this.tracker.trackAnonymous(TrackingEvent.OTP_FAILED, {
            channel: OtpChannel.PHONE,
            reason: err.error?.message || 'verification_failed',
          });
        },
      });
  }

  resendCode(): void {
    if (!this.phone) return;
    this.resendLoading.set(true);
    this.resendSuccess.set(false);
    this.authService
      .resendVerification(this.phone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resendLoading.set(false);
          this.resendSuccess.set(true);
        },
        error: () => {
          this.resendLoading.set(false);
          this.errorMessage.set('Failed to resend code. Please try again later.');
        },
      });
  }
}
