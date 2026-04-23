import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ROUTES } from '../../../core/constants/routes';

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.phone = this.route.snapshot.queryParamMap.get('phone') || '';
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  onSubmit(): void {
    if (this.verifyForm.invalid || !this.phone) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.verifyPhone(this.phone, this.verifyForm.value.code).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Invalid or expired verification code.');
      },
    });
  }

  resendCode(): void {
    if (!this.phone) return;
    this.resendLoading.set(true);
    this.resendSuccess.set(false);
    this.authService.resendVerification(this.phone).subscribe({
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
