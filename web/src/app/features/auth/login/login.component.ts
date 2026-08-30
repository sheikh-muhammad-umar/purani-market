import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService, AuthTokens } from '../../../core/auth/auth.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { SocialAuthService } from '../../../core/services/social-auth.service';
import { SocialProvider } from '../../../core/enums/social-provider';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { LOGIN_METHOD_EMAIL, LOGIN_METHOD_PHONE } from '../../../core/constants/app';
import { STORAGE_IDV_PROMPTED } from '../../../core/constants/storage-keys';
import { User } from '../../../core/models/user.model';
import { ERROR_MSG } from '../../../core/constants/error-messages';

const SOCIAL_LOGIN_PREFIX = 'social:';

/**
 * Whether a signed-in user should land on the ID step instead of the home page.
 *
 * Pure so the rule can be tested on its own: the caller supplies whether this
 * device has already been offered the step, and owns the storage side effect.
 *
 * Honours a request made during registration, which could not be acted on at the
 * time because uploading needs a session that registration does not create.
 */
export function shouldOpenIdVerification(
  user: Pick<User, 'wantsIdVerification' | 'idVerified'> | null | undefined,
  alreadyPrompted: boolean,
): boolean {
  if (!user?.wantsIdVerification) return false;
  // Nothing left to ask for.
  if (user.idVerified) return false;
  // They opted in but then skipped; do not corner them on every sign-in.
  return !alreadyPrompted;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly ROUTES = ROUTES;
  readonly SocialProvider = SocialProvider;

  loginForm: FormGroup;
  usePhone = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly tracker: ActivityTrackerService,
    private readonly socialAuth: SocialAuthService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required]],
    });
  }

  toggleLoginMethod(): void {
    this.usePhone.update((v) => !v);
    this.loginForm.reset();
    this.errorMessage.set('');
    if (this.usePhone()) {
      this.loginForm.get('email')?.clearValidators();
      this.loginForm
        .get('phone')
        ?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{6,14}$/)]);
    } else {
      this.loginForm.get('phone')?.clearValidators();
      this.loginForm.get('email')?.setValidators([Validators.required, Validators.email]);
    }
    this.loginForm.get('email')?.updateValueAndValidity();
    this.loginForm.get('phone')?.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const credentials = this.usePhone()
      ? { phone: this.loginForm.value.phone, password: this.loginForm.value.password }
      : { email: this.loginForm.value.email, password: this.loginForm.value.password };

    this.authService
      .login(credentials)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          if (this.authService.isMfaResponse(response)) {
            this.router.navigate([ROUTES.AUTH_MFA], {
              queryParams: { token: response.mfaToken },
            });
          } else {
            this.authService.storeTokens(response as AuthTokens);
            this.handlePostLogin(this.usePhone() ? LOGIN_METHOD_PHONE : LOGIN_METHOD_EMAIL);
          }
        },
        error: (err: { status: number }) => {
          this.loading.set(false);
          this.errorMessage.set(ERROR_MSG.LOGIN_FAILED);
          this.tracker.trackAnonymous(TrackingEvent.LOGIN_FAILED, {
            method: this.usePhone() ? LOGIN_METHOD_PHONE : LOGIN_METHOD_EMAIL,
            identifier: this.usePhone() ? this.loginForm.value.phone : this.loginForm.value.email,
            errorMessage: ERROR_MSG.LOGIN_FAILED,
            statusCode: err.status,
            ...this.tracker.getDeviceInfo(),
            timestamp: new Date().toISOString(),
          });
        },
      });
  }

  onSocialLogin(provider: SocialProvider): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const signIn =
      provider === SocialProvider.GOOGLE
        ? this.socialAuth.signInWithGoogle()
        : provider === SocialProvider.FACEBOOK
          ? this.socialAuth.signInWithFacebook()
          : this.socialAuth.signInWithApple();

    signIn
      .then((socialToken) => {
        this.authService
          .socialLogin(
            socialToken.provider,
            socialToken.token,
            socialToken.firstName,
            socialToken.lastName,
          )
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (tokens) => {
              this.loading.set(false);
              this.authService.storeTokens(tokens);
              this.handlePostLogin(`${SOCIAL_LOGIN_PREFIX}${provider}`);
              this.tracker.track(TrackingEvent.SOCIAL_LOGIN, {
                metadata: { provider },
              });
            },
            error: () => {
              this.loading.set(false);
              this.errorMessage.set(`${provider} login failed. Please try again.`);
            },
          });
      })
      .catch(() => {
        this.loading.set(false);
      });
  }

  private handlePostLogin(method: string): void {
    this.authService
      .fetchCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.tracker.trackLoginWithLocation({
          method,
          ...this.tracker.getDeviceInfo(),
        });

        const toIdVerification = shouldOpenIdVerification(
          user,
          localStorage.getItem(STORAGE_IDV_PROMPTED) === '1',
        );
        if (toIdVerification) {
          // Recorded before navigating, so a reload cannot replay the redirect.
          localStorage.setItem(STORAGE_IDV_PROMPTED, '1');
          this.router.navigate([ROUTES.PROFILE_ID_VERIFICATION], {
            queryParams: { welcome: 1 },
          });
          return;
        }
        this.router.navigate([ROUTES.HOME]);
      });
  }
}
