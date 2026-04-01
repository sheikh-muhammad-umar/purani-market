import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User } from '../models';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

export interface MfaEnableResponse {
  qrCodeUrl: string;
  secret: string;
}

export type LoginResponse = AuthTokens | MfaRequiredResponse;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly currentUser = signal<User | null>(null);
  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUser() || !!this.getAccessToken());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly isSeller = computed(() => this.currentUser()?.role === 'seller');

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  // --- Authentication ---

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials);
  }

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/register`, data);
  }

  socialLogin(provider: 'google' | 'facebook', token: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}/auth/social-login`, { provider, token });
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<AuthTokens>(`${this.apiUrl}/auth/refresh-token`, { refreshToken });
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe();
    this.clearTokens();
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  // --- Verification ---

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/verify-email`, { token });
  }

  verifyPhone(phone: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/verify-phone`, { phone, code });
  }

  resendVerification(emailOrPhone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/resend-verification`, {
      emailOrPhone,
    });
  }

  // --- Password Recovery ---

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  // --- MFA ---

  enableMfa(): Observable<MfaEnableResponse> {
    return this.http.post<MfaEnableResponse>(`${this.apiUrl}/auth/mfa/enable`, {});
  }

  verifyMfa(mfaToken: string, code: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}/auth/mfa/verify`, { mfaToken, code });
  }

  // --- Phone Management ---

  addPhone(phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/change-phone`, { newPhone: phone });
  }

  verifyPhoneChange(otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/change-phone/verify`, { otp });
  }

  // --- Token Management ---

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  setUser(user: User): void {
    this.currentUser.set(user);
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`).pipe(
      tap(user => this.currentUser.set(user))
    );
  }

  isMfaResponse(response: LoginResponse): response is MfaRequiredResponse {
    return 'mfaRequired' in response && response.mfaRequired === true;
  }
}
