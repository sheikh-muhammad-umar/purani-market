import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    verifyPhone: jest.fn(),
    resendVerification: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    socialLogin: jest.fn(),
    enableMfa: jest.fn(),
    verifyMfa: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    requestEmailChange: jest.fn(),
    verifyEmailChange: jest.fn(),
    requestPhoneChange: jest.fn(),
    verifyPhoneChange: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 900000, limit: 10 }] }),
      ],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /api/auth/register', () => {
    it('should call authService.register with email dto', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const expected = { message: 'Registration successful', userId: 'abc' };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });

    it('should call authService.register with phone dto', async () => {
      const dto = { phone: '+923001234567', password: 'password123' };
      const expected = { message: 'Registration successful. Please check your phone for the OTP code.', userId: 'def' };
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should call authService.verifyEmail with token', async () => {
      const dto = { token: 'valid-token' };
      const expected = { message: 'Email verified successfully' };
      mockAuthService.verifyEmail.mockResolvedValue(expected);

      const result = await controller.verifyEmail(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('POST /api/auth/verify-phone', () => {
    it('should call authService.verifyPhone with phone and otp', async () => {
      const dto = { phone: '+923001234567', otp: '123456' };
      const expected = { message: 'Phone number verified successfully' };
      mockAuthService.verifyPhone.mockResolvedValue(expected);

      const result = await controller.verifyPhone(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyPhone).toHaveBeenCalledWith('+923001234567', '123456');
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should call authService.resendVerification with email', async () => {
      const dto = { email: 'test@example.com' };
      const expected = { message: 'Verification sent successfully' };
      mockAuthService.resendVerification.mockResolvedValue(expected);

      const result = await controller.resendVerification(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
      );
    });

    it('should call authService.resendVerification with phone', async () => {
      const dto = { phone: '+923001234567' };
      const expected = { message: 'Verification sent successfully' };
      mockAuthService.resendVerification.mockResolvedValue(expected);

      const result = await controller.resendVerification(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        undefined,
        '+923001234567',
      );
    });
  });

  describe('POST /api/auth/login', () => {
    it('should call authService.login with email credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user123', email: 'test@example.com', role: 'buyer' },
      };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto, 'Mozilla/5.0');

      expect(result).toEqual(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        'password123',
        'Mozilla/5.0',
      );
    });

    it('should call authService.login with phone credentials', async () => {
      const dto = { phone: '+923001234567', password: 'password123' };
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user123', phone: '+923001234567', role: 'buyer' },
      };
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto, 'Flutter/1.0');

      expect(result).toEqual(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        undefined,
        '+923001234567',
        'password123',
        'Flutter/1.0',
      );
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should call authService.refreshToken', async () => {
      const dto = { refreshToken: 'valid-refresh-token' };
      const expected = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      mockAuthService.refreshToken.mockResolvedValue(expected);

      const result = await controller.refreshToken(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should call authService.logout with token and user id', async () => {
      const req = { headers: { authorization: 'Bearer access-token-123' } };
      const user = { sub: 'user123', jti: 'jti-123', role: 'buyer', type: 'access' };
      const expected = { message: 'Logged out successfully' };
      mockAuthService.logout.mockResolvedValue(expected);

      const result = await controller.logout(req, user as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.logout).toHaveBeenCalledWith('access-token-123', 'user123');
    });
  });

  describe('POST /api/auth/social-login', () => {
    it('should call authService.socialLogin with dto', async () => {
      const dto = { provider: 'google', token: 'google-id-token' };
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user123', email: 'social@example.com', role: 'buyer' },
      };
      mockAuthService.socialLogin.mockResolvedValue(expected);

      const result = await controller.socialLogin(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.socialLogin).toHaveBeenCalledWith(dto);
    });

    it('should call authService.socialLogin with Facebook provider', async () => {
      const dto = { provider: 'facebook', token: 'fb-access-token' };
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user456', email: 'fb@example.com', role: 'buyer' },
      };
      mockAuthService.socialLogin.mockResolvedValue(expected);

      const result = await controller.socialLogin(dto as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.socialLogin).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /api/auth/mfa/enable', () => {
    it('should call authService.enableMfa with user id', async () => {
      const user = { sub: 'user123', jti: 'jti-123', role: 'buyer', type: 'access' };
      const expected = {
        secret: 'TOTP_SECRET_BASE32',
        qrCodeUrl: 'data:image/png;base64,...',
      };
      mockAuthService.enableMfa.mockResolvedValue(expected);

      const result = await controller.enableMfa(user as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.enableMfa).toHaveBeenCalledWith('user123');
    });
  });

  describe('POST /api/auth/mfa/verify', () => {
    it('should call authService.verifyMfa with userId and code', async () => {
      const dto = { userId: 'user123', code: '123456' };
      const expected = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user123', email: 'test@example.com', role: 'buyer' },
      };
      mockAuthService.verifyMfa.mockResolvedValue(expected);

      const result = await controller.verifyMfa(dto, 'Mozilla/5.0');

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyMfa).toHaveBeenCalledWith(
        'user123',
        '123456',
        'Mozilla/5.0',
      );
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should call authService.forgotPassword with email', async () => {
      const dto = { email: 'test@example.com' };
      const expected = { message: 'If an account with that email exists, a password reset link has been sent.' };
      mockAuthService.forgotPassword.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should call authService.resetPassword with token and new password', async () => {
      const dto = { token: 'reset-token', newPassword: 'newPassword123' };
      const expected = { message: 'Password has been reset successfully' };
      mockAuthService.resetPassword.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'newPassword123',
      );
    });
  });

  describe('POST /api/auth/change-email', () => {
    it('should call authService.requestEmailChange with user id and new email', async () => {
      const user = { sub: 'user123', jti: 'jti-123', role: 'buyer', type: 'access' };
      const dto = { newEmail: 'new@example.com' };
      const expected = { message: 'Verification link sent to new email address' };
      mockAuthService.requestEmailChange.mockResolvedValue(expected);

      const result = await controller.changeEmail(dto, user as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.requestEmailChange).toHaveBeenCalledWith('user123', 'new@example.com');
    });
  });

  describe('POST /api/auth/change-email/verify', () => {
    it('should call authService.verifyEmailChange with token', async () => {
      const dto = { token: 'change-email-token' };
      const expected = { message: 'Email updated successfully' };
      mockAuthService.verifyEmailChange.mockResolvedValue(expected);

      const result = await controller.verifyEmailChange(dto);

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyEmailChange).toHaveBeenCalledWith('change-email-token');
    });
  });

  describe('POST /api/auth/change-phone', () => {
    it('should call authService.requestPhoneChange with user id and new phone', async () => {
      const user = { sub: 'user123', jti: 'jti-123', role: 'buyer', type: 'access' };
      const dto = { newPhone: '+923009876543' };
      const expected = { message: 'OTP sent to new phone number' };
      mockAuthService.requestPhoneChange.mockResolvedValue(expected);

      const result = await controller.changePhone(dto, user as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.requestPhoneChange).toHaveBeenCalledWith('user123', '+923009876543');
    });
  });

  describe('POST /api/auth/change-phone/verify', () => {
    it('should call authService.verifyPhoneChange with user id and otp', async () => {
      const user = { sub: 'user123', jti: 'jti-123', role: 'buyer', type: 'access' };
      const dto = { otp: '654321' };
      const expected = { message: 'Phone number updated successfully' };
      mockAuthService.verifyPhoneChange.mockResolvedValue(expected);

      const result = await controller.verifyPhoneChange(dto, user as any);

      expect(result).toEqual(expected);
      expect(mockAuthService.verifyPhoneChange).toHaveBeenCalledWith('user123', '654321');
    });
  });
});
