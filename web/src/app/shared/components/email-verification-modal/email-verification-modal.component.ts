import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { EmailVerificationModalService } from './email-verification-modal.service';
import { ToastService } from '../../../core/services/toast.service';

type Step = 'verify' | 'change';

@Component({
  selector: 'app-email-verification-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-verification-modal.component.html',
  styleUrl: './email-verification-modal.component.scss',
})
export class EmailVerificationModalComponent implements OnInit, OnDestroy {
  readonly step = signal<Step>('verify');
  readonly sending = signal(false);
  readonly verifying = signal(false);
  readonly error = signal('');
  readonly resendCooldown = signal(0);

  /** The address the current OTP was sent to (may differ from user.email) */
  pendingEmail = signal('');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  otpForm!: FormGroup;
  emailForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly modalService: EmailVerificationModalService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    const currentEmail = this.authService.user()?.email ?? '';
    this.pendingEmail.set(currentEmail);
    this.emailForm.patchValue({ email: currentEmail });

    // Auto-send OTP to current email when modal opens — browser only
    if (this.isBrowser) {
      this.sendOtp();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.cooldownTimer);
  }

  // ── OTP step ─────────────────────────────────────────────────────────────────

  /**
   * Sends OTP. If pendingEmail differs from user.email, passes it as
   * targetEmail so the backend sends to the new address and stores it
   * on the token — the email is only committed on successful verification.
   */
  sendOtp(targetEmail?: string): void {
    if (this.sending() || this.resendCooldown() > 0) return;
    this.sending.set(true);
    this.error.set('');

    const userEmail = this.authService.user()?.email ?? '';
    const sendTo = targetEmail ?? this.pendingEmail();
    const isNewAddress = sendTo !== userEmail;

    this.authService
      .sendEmailOtp(isNewAddress ? sendTo : undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.startCooldown(60);
        },
        error: (err) => {
          this.sending.set(false);
          const isConflict = err?.status === 409;
          this.error.set(
            isConflict
              ? 'This email is already in use by another account.'
              : 'Failed to send verification code. Please try again.',
          );
        },
      });
  }

  submitOtp(): void {
    if (this.otpForm.invalid || this.verifying()) return;
    this.verifying.set(true);
    this.error.set('');

    const otp: string = this.otpForm.get('otp')!.value;

    this.authService
      .verifyEmailOtp(otp)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.verifying.set(false);
          this.toast.success('Email verified successfully!');
          this.authService
            .fetchCurrentUser()
            .pipe(takeUntil(this.destroy$))
            .subscribe({ complete: () => this.modalService.notifyVerified() });
        },
        error: () => {
          this.verifying.set(false);
          this.error.set('Invalid code. Please check and try again.');
        },
      });
  }

  // ── Change email step ─────────────────────────────────────────────────────────

  openChangeEmail(): void {
    this.step.set('change');
    this.error.set('');
  }

  cancelChangeEmail(): void {
    this.step.set('verify');
    this.error.set('');
    this.emailForm.patchValue({ email: this.pendingEmail() });
  }

  /**
   * User confirmed the new email. Store it locally, go back to verify step,
   * reset OTP form, and send OTP to the new address.
   * The email is NOT updated in the DB yet — that happens on OTP verification.
   */
  submitEmailChange(): void {
    if (this.emailForm.invalid) return;
    const newEmail: string = this.emailForm.get('email')!.value.trim();

    this.pendingEmail.set(newEmail);
    this.step.set('verify');
    this.otpForm.reset();
    this.error.set('');
    clearInterval(this.cooldownTimer);
    this.resendCooldown.set(0);

    // Send OTP to the new address
    this.sendOtp(newEmail);
  }

  close(): void {
    this.modalService.close();
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.resendCooldown() - 1;
      if (remaining <= 0) {
        clearInterval(this.cooldownTimer);
        this.resendCooldown.set(0);
      } else {
        this.resendCooldown.set(remaining);
      }
    }, 1000);
  }
}
