import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService, MfaEnableResponse } from '../../../core/auth/auth.service';
import { ROUTES } from '../../../core/constants/routes';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';

/**
 * Which job this screen is doing. All three ask for one short secret and report
 * one error, so they share a card rather than each getting a route.
 */
type MfaMode = 'verify' | 'setup' | 'disable';

@Component({
  selector: 'app-mfa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppLoaderComponent],
  templateUrl: './mfa.component.html',
  styleUrl: './mfa.component.scss',
})
export class MfaComponent implements OnInit {
  readonly ROUTES = ROUTES;
  mfaForm: FormGroup;
  disableForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  mfaToken = '';
  mode = signal<MfaMode>('verify');
  /** Setup mode: user is enabling MFA from settings */
  isSetupMode = signal(false);
  isDisableMode = signal(false);
  setupData = signal<MfaEnableResponse | null>(null);
  setupLoading = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.mfaForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
    this.disableForm = this.fb.group({
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.mfaToken = this.route.snapshot.queryParamMap.get('token') || '';
    const params = this.route.snapshot.queryParamMap;

    if (params.get('setup') === 'true') {
      this.setMode('setup');
      this.enableMfa();
    } else if (params.get('disable') === 'true') {
      this.setMode('disable');
    } else {
      this.setMode('verify');
      if (!this.mfaToken) {
        this.errorMessage.set('No MFA session token. Please log in again.');
      }
    }
  }

  private setMode(mode: MfaMode): void {
    this.mode.set(mode);
    this.isSetupMode.set(mode === 'setup');
    this.isDisableMode.set(mode === 'disable');
  }

  enableMfa(): void {
    this.setupLoading.set(true);
    this.authService.enableMfa().subscribe({
      next: (data) => {
        this.setupLoading.set(false);
        this.setupData.set(data);
      },
      error: () => {
        this.setupLoading.set(false);
        this.errorMessage.set('Failed to start MFA setup.');
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

    // Setup and login are different exchanges against different endpoints. This
    // used to post the literal string 'setup' to the login endpoint as though it
    // were a session token, which no server route understood.
    if (this.isSetupMode()) {
      this.authService.confirmMfa(code).subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate([ROUTES.PROFILE], {
            queryParams: { mfa: 'enabled' },
          });
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('That code was not accepted. Please try again.');
        },
      });
      return;
    }

    this.authService.verifyMfa(this.mfaToken, code).subscribe({
      next: (tokens) => {
        this.loading.set(false);
        this.authService.storeTokens(tokens);
        this.authService.fetchCurrentUser().subscribe(() => {
          this.router.navigate([ROUTES.HOME]);
        });
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        // The ticket lasts five minutes and is spent once used, so an expired or
        // already-used one needs a fresh sign-in rather than another code.
        this.errorMessage.set(
          err?.status === 401 && !this.mfaForm.value.code
            ? 'This sign-in attempt expired. Please log in again.'
            : 'Invalid verification code. Please try again.',
        );
      },
    });
  }

  onDisableSubmit(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.disableMfa(this.disableForm.value.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate([ROUTES.PROFILE], {
          queryParams: { mfa: 'disabled' },
        });
      },
      error: (err: { status?: number }) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.status === 401
            ? 'That password is not correct.'
            : 'Could not turn off two-factor authentication.',
        );
      },
    });
  }
}
