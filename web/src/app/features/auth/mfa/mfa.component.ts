import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService, MfaEnableResponse } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-mfa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './mfa.component.html',
  styleUrl: './mfa.component.scss',
})
export class MfaComponent implements OnInit {
  mfaForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  mfaToken = '';
  /** Setup mode: user is enabling MFA from settings */
  isSetupMode = signal(false);
  setupData = signal<MfaEnableResponse | null>(null);
  setupLoading = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.mfaForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  ngOnInit(): void {
    this.mfaToken = this.route.snapshot.queryParamMap.get('token') || '';
    const setup = this.route.snapshot.queryParamMap.get('setup');

    if (setup === 'true') {
      this.isSetupMode.set(true);
      this.enableMfa();
    } else if (!this.mfaToken) {
      this.errorMessage.set('No MFA session token. Please log in again.');
    }
  }

  enableMfa(): void {
    this.setupLoading.set(true);
    this.authService.enableMfa().subscribe({
      next: data => {
        this.setupLoading.set(false);
        this.setupData.set(data);
      },
      error: err => {
        this.setupLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to enable MFA.');
      },
    });
  }

  onSubmit(): void {
    if (this.mfaForm.invalid) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const code = this.mfaForm.value.code;
    const token = this.isSetupMode() ? 'setup' : this.mfaToken;

    this.authService.verifyMfa(token, code).subscribe({
      next: tokens => {
        this.loading.set(false);
        this.authService.storeTokens(tokens);
        this.authService.fetchCurrentUser().subscribe(() => {
          this.router.navigate(['/']);
        });
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.message || 'Invalid verification code. Please try again.'
        );
      },
    });
  }
}
