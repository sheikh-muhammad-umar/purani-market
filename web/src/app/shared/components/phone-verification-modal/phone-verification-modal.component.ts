import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PhoneVerificationModalService } from './phone-verification-modal.service';
import { ToastService } from '../../../core/services/toast.service';

type Step = 'add' | 'verify';

@Component({
  selector: 'app-phone-verification-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './phone-verification-modal.component.html',
  styleUrl: './phone-verification-modal.component.scss',
})
export class PhoneVerificationModalComponent implements OnInit, OnDestroy {
  step = signal<Step>('add');
  sending = signal(false);
  error = signal('');
  success = signal('');
  pendingPhone = signal('');

  /** Countdown before resend is allowed */
  resendCooldown = signal(0);

  phoneForm!: FormGroup;
  otpForm!: FormGroup;

  private readonly destroy$ = new Subject<void>();
  private cooldownTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly modalService: PhoneVerificationModalService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.phoneForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^0[0-9]{10}$/)]],
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    // If user already has an unverified phone, jump straight to OTP step
    const user = this.authService.user();
    if (user?.phone && !user.phoneVerified) {
      this.pendingPhone.set(user.phone);
      this.step.set('verify');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.cooldownTimer);
  }

  // ── Step 1: submit phone number ──────────────────────────────────────────────
  submitPhone(): void {
    if (this.phoneForm.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set('');

    const phone: string = this.phoneForm.get('phone')!.value;

    this.authService
      .addPhone(phone)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.pendingPhone.set(phone);
          this.step.set('verify');
          this.success.set('OTP sent to ' + phone);
          this.startCooldown(60);
        },
        error: (err) => {
          this.sending.set(false);
          this.error.set('Failed to send OTP. Please try again.');
        },
      });
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────────────────
  submitOtp(): void {
    if (this.otpForm.invalid || this.sending()) return;
    this.sending.set(true);
    this.error.set('');

    const otp: string = this.otpForm.get('otp')!.value;
    const phone = this.pendingPhone();

    const verify$ =
      phone === this.authService.user()?.phone
        ? this.authService.verifyPhone(phone, otp)
        : this.authService.verifyPhoneChange(otp);

    verify$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.sending.set(false);
        this.toast.success('Phone verified successfully!');
        // Refresh cached user then notify
        this.authService
          .fetchCurrentUser()
          .pipe(takeUntil(this.destroy$))
          .subscribe({ complete: () => this.modalService.notifyVerified() });
      },
      error: () => {
        this.sending.set(false);
        this.error.set('Invalid OTP. Please try again.');
      },
    });
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  resendOtp(): void {
    if (this.sending() || this.resendCooldown() > 0) return;
    this.sending.set(true);
    this.error.set('');
    this.success.set('');

    const phone = this.pendingPhone();
    const resend$ =
      phone === this.authService.user()?.phone
        ? this.authService.resendVerification(phone)
        : this.authService.addPhone(phone);

    resend$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.sending.set(false);
        this.success.set('OTP resent to ' + phone);
        this.startCooldown(60);
      },
      error: () => {
        this.sending.set(false);
        this.error.set('Failed to resend OTP.');
      },
    });
  }

  close(): void {
    this.modalService.close();
  }

  changeNumber(): void {
    this.step.set('add');
    this.pendingPhone.set('');
    this.error.set('');
    this.success.set('');
    this.otpForm.reset();
    clearInterval(this.cooldownTimer);
    this.resendCooldown.set(0);
    // Pre-fill the phone form with the previous number so user can edit it
    const prev = this.authService.user()?.phone ?? '';
    this.phoneForm.patchValue({ phone: prev });
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
