import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthTokens } from '../../../core/auth/auth.service';
import { LoginModalService } from './login-modal.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-modal.component.html',
  styleUrls: ['./login-modal.component.scss'],
})
export class LoginModalComponent {
  loginForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    readonly modalService: LoginModalService,
    private readonly router: Router,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  close(): void {
    this.modalService.close();
    this.loginForm.reset();
    this.errorMessage.set('');
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        this.authService.storeTokens(response as AuthTokens);
        this.authService.fetchCurrentUser().subscribe(() => {
          this.loading.set(false);
          this.close();
          const redirect = this.modalService.getRedirectUrl();
          if (redirect) {
            this.modalService.clearRedirect();
            this.router.navigateByUrl(redirect);
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Invalid credentials. Please try again.',
        );
      },
    });
  }

  goToRegister(): void {
    this.close();
    this.router.navigate(['/auth/register']);
  }

  goToForgotPassword(): void {
    this.close();
    this.router.navigate(['/auth/forgot-password']);
  }
}
