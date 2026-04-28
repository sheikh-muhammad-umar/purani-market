import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { OtpChannel } from '../../../core/enums/otp-channel';
import { ROUTES } from '../../../core/constants/routes';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  readonly ROUTES = ROUTES;
  loading = signal(true);
  success = signal(false);
  errorMessage = signal('');
  resendLoading = signal(false);
  resendSuccess = signal(false);
  email = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    this.email = this.route.snapshot.queryParamMap.get('email') || '';

    if (token) {
      this.authService
        .verifyEmail(token)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loading.set(false);
            this.success.set(true);
            this.tracker.track(TrackingEvent.EMAIL_VERIFIED);
          },
          error: (err) => {
            this.loading.set(false);
            this.errorMessage.set(
              err.error?.message || 'Verification failed. The link may have expired.',
            );
            this.tracker.trackAnonymous(TrackingEvent.OTP_FAILED, {
              channel: OtpChannel.EMAIL,
              reason: err.error?.message || 'verification_failed',
            });
          },
        });
    } else {
      this.loading.set(false);
      this.errorMessage.set('No verification token provided.');
    }
  }

  resendVerification(): void {
    if (!this.email) return;
    this.resendLoading.set(true);
    this.authService
      .resendVerification(this.email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resendLoading.set(false);
          this.resendSuccess.set(true);
        },
        error: () => {
          this.resendLoading.set(false);
        },
      });
  }
}
