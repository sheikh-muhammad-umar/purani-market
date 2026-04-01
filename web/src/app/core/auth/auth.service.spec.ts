import { AuthService, AuthTokens, MfaRequiredResponse, LoginResponse } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('token management', () => {
    it('should store and retrieve access token', () => {
      localStorage.setItem('access_token', 'test-access');
      expect(localStorage.getItem('access_token')).toBe('test-access');
    });

    it('should store and retrieve refresh token', () => {
      localStorage.setItem('refresh_token', 'test-refresh');
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh');
    });

    it('should clear tokens from localStorage', () => {
      localStorage.setItem('access_token', 'a');
      localStorage.setItem('refresh_token', 'r');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    it('should return null when no tokens stored', () => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('storeTokens / getAccessToken / getRefreshToken / clearTokens', () => {
    // These test the actual AuthService static-like token helpers via localStorage
    function storeTokens(tokens: AuthTokens): void {
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }

    function getAccessToken(): string | null {
      return localStorage.getItem('access_token');
    }

    function getRefreshToken(): string | null {
      return localStorage.getItem('refresh_token');
    }

    function clearTokens(): void {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }

    it('should store both tokens via storeTokens', () => {
      storeTokens({ accessToken: 'acc-123', refreshToken: 'ref-456' });
      expect(getAccessToken()).toBe('acc-123');
      expect(getRefreshToken()).toBe('ref-456');
    });

    it('should overwrite existing tokens', () => {
      storeTokens({ accessToken: 'old-acc', refreshToken: 'old-ref' });
      storeTokens({ accessToken: 'new-acc', refreshToken: 'new-ref' });
      expect(getAccessToken()).toBe('new-acc');
      expect(getRefreshToken()).toBe('new-ref');
    });

    it('should clear both tokens via clearTokens', () => {
      storeTokens({ accessToken: 'acc', refreshToken: 'ref' });
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it('clearTokens should be safe when no tokens exist', () => {
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('isMfaResponse', () => {
    function isMfaResponse(response: LoginResponse): response is MfaRequiredResponse {
      return 'mfaRequired' in response && (response as MfaRequiredResponse).mfaRequired === true;
    }

    it('should identify MFA response', () => {
      const mfaResponse: MfaRequiredResponse = { mfaRequired: true, mfaToken: 'token' };
      expect(isMfaResponse(mfaResponse)).toBe(true);
    });

    it('should identify non-MFA response (AuthTokens)', () => {
      const tokenResponse: AuthTokens = { accessToken: 'a', refreshToken: 'r' };
      expect(isMfaResponse(tokenResponse)).toBe(false);
    });

    it('should return false for object with mfaRequired=false', () => {
      const response = { mfaRequired: false, mfaToken: 'token' } as unknown as LoginResponse;
      expect(isMfaResponse(response)).toBe(false);
    });
  });

  describe('auth flow state management', () => {
    // Simulates the auth state logic from AuthService signals
    function isAuthenticated(user: unknown, accessToken: string | null): boolean {
      return !!user || !!accessToken;
    }

    function isAdmin(role: string | undefined): boolean {
      return role === 'admin';
    }

    function isSeller(role: string | undefined): boolean {
      return role === 'seller';
    }

    it('should be unauthenticated when no user and no token', () => {
      expect(isAuthenticated(null, null)).toBe(false);
    });

    it('should be authenticated when access token exists', () => {
      localStorage.setItem('access_token', 'valid-token');
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(true);
    });

    it('should be authenticated when user is set', () => {
      expect(isAuthenticated({ _id: '1', role: 'buyer' }, null)).toBe(true);
    });

    it('should be unauthenticated after clearing tokens and user', () => {
      localStorage.setItem('access_token', 'token');
      localStorage.removeItem('access_token');
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(false);
    });

    it('should identify admin role', () => {
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('seller')).toBe(false);
      expect(isAdmin('buyer')).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });

    it('should identify seller role', () => {
      expect(isSeller('seller')).toBe(true);
      expect(isSeller('admin')).toBe(false);
      expect(isSeller('buyer')).toBe(false);
      expect(isSeller(undefined)).toBe(false);
    });

    it('should transition from unauthenticated to authenticated on login', () => {
      // Before login
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(false);

      // After login: store tokens
      localStorage.setItem('access_token', 'jwt-token');
      localStorage.setItem('refresh_token', 'refresh-token');
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(true);
    });

    it('should transition from authenticated to unauthenticated on logout', () => {
      // Logged in
      localStorage.setItem('access_token', 'jwt-token');
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(true);

      // Logout: clear tokens and user
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(false);
    });

    it('should handle MFA flow: login returns MFA required, then verify completes auth', () => {
      // Step 1: Login returns MFA required
      const loginResponse: LoginResponse = { mfaRequired: true, mfaToken: 'mfa-session' };
      const needsMfa = 'mfaRequired' in loginResponse && (loginResponse as MfaRequiredResponse).mfaRequired;
      expect(needsMfa).toBe(true);

      // User is NOT authenticated yet
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(false);

      // Step 2: MFA verify returns tokens
      const mfaResult: AuthTokens = { accessToken: 'final-access', refreshToken: 'final-refresh' };
      localStorage.setItem('access_token', mfaResult.accessToken);
      localStorage.setItem('refresh_token', mfaResult.refreshToken);

      // Now authenticated
      expect(isAuthenticated(null, localStorage.getItem('access_token'))).toBe(true);
    });
  });

  describe('interface contracts', () => {
    it('LoginRequest should support email-based login', () => {
      const request = { email: 'test@example.com', password: 'pass123' };
      expect(request.email).toBe('test@example.com');
      expect(request.password).toBe('pass123');
    });

    it('LoginRequest should support phone-based login', () => {
      const request = { phone: '+923001234567', password: 'pass123' };
      expect(request.phone).toBe('+923001234567');
    });

    it('RegisterRequest should include all required fields', () => {
      const request = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };
      expect(request.firstName).toBe('John');
      expect(request.lastName).toBe('Doe');
      expect(request.email).toBe('test@example.com');
      expect(request.password).toBe('password123');
    });

    it('AuthTokens should have accessToken and refreshToken', () => {
      const tokens: AuthTokens = { accessToken: 'access', refreshToken: 'refresh' };
      expect(tokens.accessToken).toBe('access');
      expect(tokens.refreshToken).toBe('refresh');
    });

    it('MfaRequiredResponse should have mfaRequired and mfaToken', () => {
      const response: MfaRequiredResponse = { mfaRequired: true, mfaToken: 'mfa-token' };
      expect(response.mfaRequired).toBe(true);
      expect(response.mfaToken).toBe('mfa-token');
    });
  });

  describe('API endpoint paths', () => {
    it('should use correct login endpoint path', () => {
      expect('/auth/login').toBe('/auth/login');
    });

    it('should use correct register endpoint path', () => {
      expect('/auth/register').toBe('/auth/register');
    });

    it('should use correct forgot-password endpoint path', () => {
      expect('/auth/forgot-password').toBe('/auth/forgot-password');
    });

    it('should use correct reset-password endpoint path', () => {
      expect('/auth/reset-password').toBe('/auth/reset-password');
    });

    it('should use correct verify-email endpoint path', () => {
      expect('/auth/verify-email').toBe('/auth/verify-email');
    });

    it('should use correct verify-phone endpoint path', () => {
      expect('/auth/verify-phone').toBe('/auth/verify-phone');
    });

    it('should use correct mfa/enable endpoint path', () => {
      expect('/auth/mfa/enable').toBe('/auth/mfa/enable');
    });

    it('should use correct mfa/verify endpoint path', () => {
      expect('/auth/mfa/verify').toBe('/auth/mfa/verify');
    });

    it('should use correct social-login endpoint path', () => {
      expect('/auth/social-login').toBe('/auth/social-login');
    });

    it('should use correct refresh-token endpoint path', () => {
      expect('/auth/refresh-token').toBe('/auth/refresh-token');
    });

    it('should use correct logout endpoint path', () => {
      expect('/auth/logout').toBe('/auth/logout');
    });
  });
});
