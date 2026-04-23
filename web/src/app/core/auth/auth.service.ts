import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User } from '../models';
import { environment } from '../../../environments/environment';
import { ROUTES } from '../constants/routes';
import { API } from '../constants/api-endpoints';
import { STORAGE_ACCESS_TOKEN, STORAGE_REFRESH_TOKEN } from '../constants/storage-keys';

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
  readonly isAdmin = computed(
    () => this.currentUser()?.role === 'admin' || this.currentUser()?.role === 'super_admin',
  );
  readonly isSuperAdmin = computed(() => this.currentUser()?.role === 'super_admin');

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

  socialLogin(provider: 'google' | 'facebook', token: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}${API.AUTH_SOCIAL_LOGIN}`, {
      provider,
      token,
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
    this.router.navigate([ROUTES.AUTH_LOGIN]);
  }

  // --- Verification ---

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_VERIFY_EMAIL}`, { token });
  }

  verifyPhone(phone: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_VERIFY_PHONE}`, {
      phone,
      code,
    });
  }

  resendVerification(emailOrPhone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}${API.AUTH_RESEND_VERIFICATION}`, {
      emailOrPhone,
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

  enableMfa(): Observable<MfaEnableResponse> {
    return this.http.post<MfaEnableResponse>(`${this.apiUrl}${API.AUTH_MFA_ENABLE}`, {});
  }

  verifyMfa(mfaToken: string, code: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}${API.AUTH_MFA_VERIFY}`, { mfaToken, code });
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
    return localStorage.getItem(STORAGE_ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_REFRESH_TOKEN);
  }

  storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(STORAGE_REFRESH_TOKEN, tokens.refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(STORAGE_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  }

  setUser(user: User): void {
    this.currentUser.set(user);
  }

  fetchCurrentUser(): Observable<User> {
    return this.http
      .get<User>(`${this.apiUrl}${API.USERS_ME}`)
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  isMfaResponse(response: LoginResponse): response is MfaRequiredResponse {
    return 'mfaRequired' in response && response.mfaRequired === true;
  }
}
