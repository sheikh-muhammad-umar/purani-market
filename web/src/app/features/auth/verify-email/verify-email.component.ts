import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
  loading = signal(true);
  success = signal(false);
  errorMessage = signal('');
  resendLoading = signal(false);
  resendSuccess = signal(false);
  email = '';

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    this.email = this.route.snapshot.queryParamMap.get('email') || '';

    if (token) {
      this.authService.verifyEmail(token).subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.error?.message || 'Verification failed. The link may have expired.',
          );
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
    this.authService.resendVerification(this.email).subscribe({
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
