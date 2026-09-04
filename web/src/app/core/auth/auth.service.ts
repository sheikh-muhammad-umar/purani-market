import { isPlatformBrowser } from '@angular/common';
import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, shareReplay } from 'rxjs';
import { User } from '../models';
import { UserRole } from '../constants/enums';
import { SocialProvider } from '../enums/social-provider';
import {
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  LoginResponse,
  MfaRequiredResponse,
  MfaEnableResponse,
} from './auth.types';
import { environment } from '../../../environments/environment';
import { ROUTES } from '../constants/routes';
import { API } from '../constants/api-endpoints';
import { STORAGE_ACCESS_TOKEN, STORAGE_REFRESH_TOKEN } from '../constants/storage-keys';

export type {
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  LoginResponse,
  MfaRequiredResponse,
  MfaEnableResponse,
} from './auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = environment.apiUrl;
  private readonly currentUser = signal<User | null>(null);
  private userCache$: Observable<User> | null = null;
  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUser() || !!this.getAccessToken());
  readonly isAdmin = computed(
    () =>
      this.currentUser()?.role === UserRole.ADMIN ||
      this.currentUser()?.role === UserRole.SUPER_ADMIN,
  );
  readonly isSuperAdmin = computed(() => this.currentUser()?.role === UserRole.SUPER_ADMIN);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  // --- Authentication ---

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}${API.AUTH_LOGIN}`, credentials);
  }

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_REGISTER}`, data);
  }

  socialLogin(
    provider: SocialProvider,
    token: string,
    firstName?: string,
    lastName?: string,
  ): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}${API.AUTH_SOCIAL_LOGIN}`, {
      provider,
      token,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<AuthTokens>(`${this.apiUrl}${API.AUTH_REFRESH_TOKEN}`, { refreshToken });
  }

  logout(): void {
    this.http.post(`${this.apiUrl}${API.AUTH_LOGOUT}`, {}).subscribe();
    this.clearTokens();
    this.currentUser.set(null);
    this.userCache$ = null;
    this.router.navigate([ROUTES.HOME]);
  }

  // --- Verification ---

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_VERIFY_EMAIL}`, { token });
  }

  verifyPhone(phone: string, otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_VERIFY_PHONE}`, {
      phone,
      otp,
    });
  }

  resendVerification(emailOrPhone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_RESEND_VERIFICATION}`, {
      emailOrPhone,
    });
  }

  /**
   * @param password required only when `targetEmail` differs from the address on
   * the account — that case moves where password resets are delivered, so the
   * server re-checks the password.
   */
  sendEmailOtp(targetEmail?: string, password?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}${API.AUTH_SEND_EMAIL_OTP}`,
      targetEmail ? { targetEmail, ...(password ? { password } : {}) } : {},
    );
  }

  verifyEmailOtp(otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_VERIFY_EMAIL_OTP}`, {
      otp,
    });
  }

  // --- Password Recovery ---

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_FORGOT_PASSWORD}`, {
      email,
    });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_RESET_PASSWORD}`, {
      token,
      newPassword,
    });
  }

  // --- MFA ---

  /**
   * Begins setup and returns the QR code. MFA is not active until
   * {@link confirmMfa} succeeds, so abandoning this screen is harmless.
   */
  enableMfa(): Observable<MfaEnableResponse> {
    return this.http.post<MfaEnableResponse>(`${this.apiUrl}${API.AUTH_MFA_ENABLE}`, {});
  }

  /** Completes setup by proving the authenticator app produces valid codes. */
  confirmMfa(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_MFA_CONFIRM}`, { code });
  }

  /**
   * Second half of an MFA login.
   *
   * @param mfaToken the ticket from the login response. Previously this sent a
   * field the server did not read while omitting the one it required, so MFA
   * logins from the browser could not complete at all.
   */
  verifyMfa(mfaToken: string, code: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}${API.AUTH_MFA_VERIFY}`, { mfaToken, code });
  }

  /** Requires the account password: an access token alone must not remove MFA. */
  disableMfa(password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_MFA_DISABLE}`, {
      password,
    });
  }

  /**
   * Changes the password while signed in. Ends every session, including this
   * one, so the caller has to sign in again afterwards.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_CHANGE_PASSWORD}`, {
      currentPassword,
      newPassword,
    });
  }

  // --- Phone Management ---

  addPhone(phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_CHANGE_PHONE}`, {
      newPhone: phone,
    });
  }

  verifyPhoneChange(otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_CHANGE_PHONE_VERIFY}`, {
      otp,
    });
  }

  // --- Token Management ---

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(STORAGE_ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(STORAGE_REFRESH_TOKEN);
  }

  storeTokens(tokens: AuthTokens): void {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(STORAGE_REFRESH_TOKEN, tokens.refreshToken);
  }

  clearTokens(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  }

  setUser(user: User): void {
    this.currentUser.set(user);
    this.userCache$ = null; // Invalidate cache when user is explicitly set
  }

  /**
   * Fetches the current user from the API. Concurrent calls share the same
   * in-flight request. The cache is invalidated on logout, setUser, or
   * after the response completes (so the next call gets fresh data).
   */
  fetchCurrentUser(): Observable<User> {
    if (!this.userCache$) {
      this.userCache$ = this.http.get<User>(`${this.apiUrl}${API.USERS_ME}`).pipe(
        tap((user) => this.currentUser.set(user)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.userCache$;
  }

  /** Invalidate the user cache so the next fetchCurrentUser() hits the API */
  invalidateUserCache(): void {
    this.userCache$ = null;
  }

  isMfaResponse(response: LoginResponse): response is MfaRequiredResponse {
    return 'mfaRequired' in response && response.mfaRequired === true;
  }
}
