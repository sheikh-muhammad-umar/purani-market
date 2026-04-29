import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { EmailService } from './services/email.service.js';
import { SmsService } from './services/sms.service.js';
import { User } from '../users/schemas/user.schema.js';
import { VerificationToken } from './schemas/verification-token.schema.js';
import { SocialProvider } from './dto/social-login.dto.js';
import { RecommendationService } from '../ai/recommendation.service.js';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  const mockVerificationTokenModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendReminderEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined),
    sendEmailChangeNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockSmsService = {
    sendOtp: jest.fn().mockResolvedValue(undefined),
    sendReminderSms: jest.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.accessExpiration': '15m',
        'jwt.refreshExpiration': '7d',
      };
      return config[key];
    }),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn().mockResolvedValue(['0', []]),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken(VerificationToken.name),
          useValue: mockVerificationTokenModel,
        },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SmsService, useValue: mockSmsService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: RecommendationService,
          useValue: { trackActivity: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a user with email and send verification email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const mockUser = { _id: { toString: () => 'user123' } };
      mockUserModel.create.mockResolvedValue(mockUser);
      mockVerificationTokenModel.create.mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.userId).toBe('user123');
      expect(result.message).toContain('email');
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should register a user with phone and send OTP', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const mockUser = { _id: { toString: () => 'user456' } };
      mockUserModel.create.mockResolvedValue(mockUser);
      mockVerificationTokenModel.create.mockResolvedValue({});

      const result = await service.register({
        phone: '+923001234567',
        password: 'password123',
      });

      expect(result.userId).toBe('user456');
      expect(result.message).toContain('OTP');
      expect(mockSmsService.sendOtp).toHaveBeenCalled();
    });

    it('should hash password with bcrypt cost factor 12', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const mockUser = { _id: { toString: () => 'user789' } };
      mockUserModel.create.mockResolvedValue(mockUser);
      mockVerificationTokenModel.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'mypassword',
      });

      const createCall = mockUserModel.create.mock.calls[0][0];
      const isValid = await bcrypt.compare(
        'mypassword',
        createCall.passwordHash,
      );
      expect(isValid).toBe(true);
      expect(createCall.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'existing' }),
      });

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when neither email nor phone provided', async () => {
      await expect(
        service.register({ password: 'password123' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const mockRecord = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toContain('verified');
      expect(mockRecord.used).toBe(true);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyPhone', () => {
    it('should verify phone with valid OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = { _id: 'user123' };
      const mockRecord = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 600000),
        token: otpHash,
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.verifyPhone('+923001234567', '123456');
      expect(result.message).toContain('verified');
    });

    it('should throw NotFoundException for unknown phone', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.verifyPhone('+923009999999', '123456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resendVerification', () => {
    it('should resend email verification', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        emailVerified: false,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      mockVerificationTokenModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockVerificationTokenModel.create.mockResolvedValue({});

      const result = await service.resendVerification('test@example.com');
      expect(result.message).toContain('sent');
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        emailVerified: false,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });

      await expect(
        service.resendVerification('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isUserVerified', () => {
    it('should return false for unverified email user', () => {
      const user = { email: 'test@example.com', emailVerified: false } as any;
      expect(service.isUserVerified(user)).toBe(false);
    });

    it('should return true for verified email user', () => {
      const user = { email: 'test@example.com', emailVerified: true } as any;
      expect(service.isUserVerified(user)).toBe(true);
    });
  });

  describe('login', () => {
    const passwordHash = bcrypt.hashSync('password123', 12);
    const mockUser = {
      _id: { toString: () => 'user123' },
      email: 'test@example.com',
      phone: undefined,
      passwordHash,
      role: 'buyer',
      status: 'active',
    };

    it('should login with valid email and password and return tokens', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(
        'test@example.com',
        undefined,
        'password123',
        'Mozilla/5.0',
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user!.id).toBe('user123');
      expect(result.user!.email).toBe('test@example.com');
      expect(result.user!.role).toBe('buyer');
    });

    it('should record login timestamp and device info', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.login(
        'test@example.com',
        undefined,
        'password123',
        'Mozilla/5.0',
      );

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          lastLoginDevice: 'Mozilla/5.0',
        }),
      );
    });

    it('should store refresh token in Redis', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.login('test@example.com', undefined, 'password123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:/),
        'user123',
        'EX',
        expect.any(Number),
      );
    });

    it('should throw UnauthorizedException for invalid email (generic error)', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.login('wrong@example.com', undefined, 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      // Verify the error message is generic
      try {
        await service.login('wrong@example.com', undefined, 'password123');
      } catch (e: any) {
        expect(e.message).toBe('Invalid credentials');
      }
    });

    it('should throw UnauthorizedException for invalid password (generic error)', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        service.login('test@example.com', undefined, 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login('test@example.com', undefined, 'wrongpassword');
      } catch (e: any) {
        expect(e.message).toBe('Invalid credentials');
      }
    });

    it('should throw UnauthorizedException when neither email nor phone provided', async () => {
      await expect(
        service.login(undefined, undefined, 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login with phone number', async () => {
      const phoneUser = {
        ...mockUser,
        phone: '+923001234567',
        email: undefined,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(phoneUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(
        undefined,
        '+923001234567',
        'password123',
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.user!.phone).toBe('+923001234567');
    });

    it('should return mfaRequired when user has MFA enabled', async () => {
      const mfaUser = {
        ...mockUser,
        mfa: { enabled: true, totpSecret: 'SECRET123', failedAttempts: 0 },
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mfaUser),
      });

      const result = await service.login(
        'test@example.com',
        undefined,
        'password123',
        'Mozilla/5.0',
      );

      expect(result.mfaRequired).toBe(true);
      expect(result.userId).toBe('user123');
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });

    it('should set lastLoginDevice to "unknown" when no user-agent', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.login('test@example.com', undefined, 'password123');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          lastLoginDevice: 'unknown',
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
        role: 'buyer',
        type: 'refresh',
        jti: 'refresh-jti-123',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockRedis.get.mockResolvedValue('user123');
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: { toString: () => 'user123' },
          email: 'test@example.com',
          role: 'buyer',
        }),
      });
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should invalidate old refresh token and store new one', async () => {
      const payload = {
        sub: 'user123',
        type: 'refresh',
        jti: 'old-jti',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockRedis.get.mockResolvedValue('user123');
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: { toString: () => 'user123' },
          email: 'test@example.com',
          role: 'buyer',
        }),
      });

      await service.refreshToken('old-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith('rt:old-jti');
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:/),
        'user123',
        'EX',
        expect.any(Number),
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-refresh token type', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user123',
        type: 'access',
        jti: 'some-jti',
      });

      await expect(
        service.refreshToken('access-token-used-as-refresh'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user123',
        type: 'refresh',
        jti: 'revoked-jti',
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.refreshToken('revoked-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should blacklist access token in Redis', async () => {
      const payload = {
        sub: 'user123',
        type: 'access',
        jti: 'access-jti-123',
      };
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.logout('valid-access-token', 'user123');

      expect(result.message).toBe('Logged out successfully');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'bl:access-jti-123',
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should handle expired token by decoding and blacklisting', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('token expired');
      });
      mockJwtService.decode.mockReturnValue({
        sub: 'user123',
        jti: 'expired-jti',
      });

      const result = await service.logout('expired-token', 'user123');

      expect(result.message).toBe('Logged out successfully');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'bl:expired-jti',
        '1',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('parseExpirationToSeconds', () => {
    it('should parse minutes correctly', () => {
      expect(service.parseExpirationToSeconds('15m')).toBe(900);
    });

    it('should parse hours correctly', () => {
      expect(service.parseExpirationToSeconds('1h')).toBe(3600);
    });

    it('should parse days correctly', () => {
      expect(service.parseExpirationToSeconds('7d')).toBe(604800);
    });

    it('should parse seconds correctly', () => {
      expect(service.parseExpirationToSeconds('30s')).toBe(30);
    });

    it('should return default for invalid format', () => {
      expect(service.parseExpirationToSeconds('invalid')).toBe(900);
    });
  });

  describe('socialLogin', () => {
    const mockSavedUser = {
      _id: { toString: () => 'user-social-1' },
      email: 'social@example.com',
      phone: undefined,
      role: 'buyer',
      emailVerified: true,
      socialLogins: [{ provider: 'google', providerId: 'google-123' }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockJwtService.sign
        .mockReturnValueOnce('social-access-token')
        .mockReturnValueOnce('social-refresh-token');
    });

    it('should login existing user with matching social login (Google)', async () => {
      // Mock Google token verification
      const verifyIdTokenSpy = jest
        .spyOn(service as any, 'verifyGoogleToken')
        .mockResolvedValue({
          email: 'social@example.com',
          sub: 'google-123',
          firstName: 'John',
          lastName: 'Doe',
        });

      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockSavedUser),
      }); // social login match
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        token: 'valid-google-id-token',
      });

      expect(result.accessToken).toBe('social-access-token');
      expect(result.refreshToken).toBe('social-refresh-token');
      expect(result.user.id).toBe('user-social-1');
      expect(result.user.email).toBe('social@example.com');
      verifyIdTokenSpy.mockRestore();
    });

    it('should link social login to existing user with matching email', async () => {
      const existingUser = {
        _id: { toString: () => 'user-existing' },
        email: 'existing@example.com',
        phone: undefined,
        role: 'buyer',
        emailVerified: false,
        socialLogins: [],
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(service as any, 'verifyGoogleToken').mockResolvedValue({
        email: 'existing@example.com',
        sub: 'google-456',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }) // no social login match
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(existingUser),
        }); // email match
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        token: 'valid-google-id-token',
      });

      expect(existingUser.socialLogins).toHaveLength(1);
      expect(existingUser.socialLogins[0]).toEqual({
        provider: 'google',
        providerId: 'google-456',
      });
      expect(existingUser.emailVerified).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
      expect(result.user.id).toBe('user-existing');

      (service as any).verifyGoogleToken.mockRestore();
    });

    it('should create new user when no matching social login or email exists', async () => {
      const newUser = {
        _id: { toString: () => 'user-new' },
        email: 'new@example.com',
        phone: undefined,
        role: 'buyer',
        emailVerified: true,
        socialLogins: [{ provider: 'google', providerId: 'google-789' }],
      };

      jest.spyOn(service as any, 'verifyGoogleToken').mockResolvedValue({
        email: 'new@example.com',
        sub: 'google-789',
        firstName: 'New',
        lastName: 'User',
      });

      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }) // no social login match
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }); // no email match
      mockUserModel.create.mockResolvedValue(newUser);
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        token: 'valid-google-id-token',
      });

      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          emailVerified: true,
          socialLogins: [{ provider: 'google', providerId: 'google-789' }],
          profile: { firstName: 'New', lastName: 'User' },
        }),
      );
      expect(result.user.id).toBe('user-new');

      (service as any).verifyGoogleToken.mockRestore();
    });

    it('should login with Facebook provider', async () => {
      jest.spyOn(service as any, 'verifyFacebookToken').mockResolvedValue({
        email: 'fb@example.com',
        id: 'fb-123',
        firstName: 'FB',
        lastName: 'User',
      });

      const fbUser = {
        _id: { toString: () => 'user-fb' },
        email: 'fb@example.com',
        phone: undefined,
        role: 'buyer',
        socialLogins: [{ provider: 'facebook', providerId: 'fb-123' }],
      };

      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(fbUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.socialLogin({
        provider: SocialProvider.FACEBOOK,
        token: 'valid-fb-token',
      });

      expect(result.accessToken).toBe('social-access-token');
      expect(result.user.id).toBe('user-fb');

      (service as any).verifyFacebookToken.mockRestore();
    });

    it('should store refresh token in Redis on social login', async () => {
      jest.spyOn(service as any, 'verifyGoogleToken').mockResolvedValue({
        email: 'social@example.com',
        sub: 'google-123',
        firstName: 'John',
        lastName: 'Doe',
      });

      mockUserModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockSavedUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.socialLogin({
        provider: SocialProvider.GOOGLE,
        token: 'valid-google-id-token',
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:/),
        'user-social-1',
        'EX',
        expect.any(Number),
      );

      (service as any).verifyGoogleToken.mockRestore();
    });

    it('should throw UnauthorizedException for invalid Google token', async () => {
      jest
        .spyOn(service as any, 'verifyGoogleToken')
        .mockRejectedValue(new UnauthorizedException('Invalid Google token'));

      await expect(
        service.socialLogin({
          provider: SocialProvider.GOOGLE,
          token: 'invalid-token',
        }),
      ).rejects.toThrow(UnauthorizedException);

      (service as any).verifyGoogleToken.mockRestore();
    });

    it('should throw UnauthorizedException for invalid Facebook token', async () => {
      jest
        .spyOn(service as any, 'verifyFacebookToken')
        .mockRejectedValue(new UnauthorizedException('Invalid Facebook token'));

      await expect(
        service.socialLogin({
          provider: SocialProvider.FACEBOOK,
          token: 'invalid-token',
        }),
      ).rejects.toThrow(UnauthorizedException);

      (service as any).verifyFacebookToken.mockRestore();
    });

    it('should mark email as verified when linking social login to existing unverified user', async () => {
      const unverifiedUser = {
        _id: { toString: () => 'user-unverified' },
        email: 'unverified@example.com',
        phone: undefined,
        role: 'buyer',
        emailVerified: false,
        socialLogins: [],
        save: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(service as any, 'verifyFacebookToken').mockResolvedValue({
        email: 'unverified@example.com',
        id: 'fb-999',
        firstName: 'Test',
        lastName: 'User',
      });

      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(unverifiedUser),
        });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.socialLogin({
        provider: SocialProvider.FACEBOOK,
        token: 'valid-fb-token',
      });

      expect(unverifiedUser.emailVerified).toBe(true);
      expect(unverifiedUser.save).toHaveBeenCalled();

      (service as any).verifyFacebookToken.mockRestore();
    });
  });

  describe('enableMfa', () => {
    it('should generate TOTP secret and return QR code URL', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        mfa: { enabled: false },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.enableMfa('user123');

      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe('string');
      expect(result.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          'mfa.totpSecret': expect.any(String),
          'mfa.enabled': true,
          'mfa.failedAttempts': 0,
          'mfa.lockedUntil': null,
        }),
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.enableMfa('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if MFA is already enabled', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        mfa: { enabled: true, totpSecret: 'EXISTING_SECRET' },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.enableMfa('user123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyMfa', () => {
    const totpSecret = 'WD4LCTZHTBPX7VOL2YK4CU5HEAZANJFA';

    it('should return tokens on valid TOTP code', async () => {
      const { generateSync } = require('otplib');
      const validCode = generateSync({ secret: totpSecret });

      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        phone: undefined,
        role: 'buyer',
        mfa: {
          enabled: true,
          totpSecret,
          failedAttempts: 0,
          lockedUntil: null,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockJwtService.sign.mockReset();
      mockJwtService.sign
        .mockReturnValueOnce('mfa-access-token')
        .mockReturnValueOnce('mfa-refresh-token');

      const result = await service.verifyMfa(
        'user123',
        validCode,
        'Mozilla/5.0',
      );

      expect(result.accessToken).toBe('mfa-access-token');
      expect(result.refreshToken).toBe('mfa-refresh-token');
      expect(result.user.id).toBe('user123');
      // Should reset failed attempts
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          'mfa.failedAttempts': 0,
          'mfa.lockedUntil': null,
        }),
      );
    });

    it('should throw UnauthorizedException on invalid TOTP code', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        role: 'buyer',
        mfa: {
          enabled: true,
          totpSecret,
          failedAttempts: 0,
          lockedUntil: null,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await expect(service.verifyMfa('user123', '000000')).rejects.toThrow(
        UnauthorizedException,
      );

      // Should increment failed attempts
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          'mfa.failedAttempts': 1,
        }),
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        role: 'buyer',
        mfa: {
          enabled: true,
          totpSecret,
          failedAttempts: 4,
          lockedUntil: null,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await expect(service.verifyMfa('user123', '000000')).rejects.toThrow(
        ForbiddenException,
      );

      // Should set lockedUntil
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          'mfa.lockedUntil': expect.any(Date),
          'mfa.failedAttempts': 0,
        }),
      );
    });

    it('should throw ForbiddenException when account is locked', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        role: 'buyer',
        mfa: {
          enabled: true,
          totpSecret,
          failedAttempts: 0,
          lockedUntil: futureDate,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyMfa('user123', '123456')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.verifyMfa('nonexistent', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException when MFA is not enabled', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'test@example.com',
        role: 'buyer',
        mfa: { enabled: false },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyMfa('user123', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for registered user', async () => {
      const mockUser = { _id: 'user123', email: 'test@example.com' };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockVerificationTokenModel.create.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('should return generic success for unregistered email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should invalidate previous password reset tokens', async () => {
      const mockUser = { _id: 'user123', email: 'test@example.com' };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockVerificationTokenModel.create.mockResolvedValue({});

      await service.forgotPassword('test@example.com');

      expect(mockVerificationTokenModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          type: 'password_reset',
          used: false,
        }),
        { used: true },
      );
    });

    it('should create a token valid for 30 minutes', async () => {
      const mockUser = { _id: 'user123', email: 'test@example.com' };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockVerificationTokenModel.create.mockResolvedValue({});

      const before = Date.now();
      await service.forgotPassword('test@example.com');
      const after = Date.now();

      const createCall = mockVerificationTokenModel.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt.getTime();
      // Should expire ~30 minutes from now
      expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 1000);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const mockRecord = {
        userId: { toString: () => 'user123' },
        expiresAt: new Date(Date.now() + 1800000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.resetPassword(
        'valid-token',
        'newPassword123',
      );

      expect(result.message).toContain('reset successfully');
      expect(mockRecord.used).toBe(true);
      expect(mockRecord.save).toHaveBeenCalled();
    });

    it('should hash new password with bcrypt cost factor 12', async () => {
      const mockRecord = {
        userId: { toString: () => 'user123' },
        expiresAt: new Date(Date.now() + 1800000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.resetPassword('valid-token', 'newPassword123');

      const updateCall = mockUserModel.findByIdAndUpdate.mock.calls[0];
      const passwordHash = updateCall[1].passwordHash;
      const isValid = await bcrypt.compare('newPassword123', passwordHash);
      expect(isValid).toBe(true);
      expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
    });

    it('should invalidate all sessions via Redis scan', async () => {
      const mockRecord = {
        userId: { toString: () => 'user123' },
        expiresAt: new Date(Date.now() + 1800000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockRedis.smembers.mockResolvedValueOnce(['jti-1', 'jti-2']);

      await service.resetPassword('valid-token', 'newPassword123');

      expect(mockRedis.smembers).toHaveBeenCalledWith('rt_set:user123');
      expect(mockRedis.del).toHaveBeenCalledWith('rt:jti-1', 'rt:jti-2');
      expect(mockRedis.del).toHaveBeenCalledWith('rt_set:user123');
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.resetPassword('invalid-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const mockRecord = {
        userId: { toString: () => 'user123' },
        expiresAt: new Date(Date.now() - 1000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });

      await expect(
        service.resetPassword('expired-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestEmailChange', () => {
    const mockUser = {
      _id: { toString: () => 'user123' },
      email: 'old@example.com',
      verificationChangeCount: { count: 0, resetAt: null },
    };

    it('should send verification email to new address', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.requestEmailChange(
        'user123',
        'new@example.com',
      );

      expect(result.message).toContain('Verification link sent');
      expect(mockEmailService.sendEmailChangeVerification).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
      );
    });

    it('should store pending email change on user document', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.requestEmailChange('user123', 'new@example.com');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          pendingEmailChange: expect.objectContaining({
            newEmail: 'new@example.com',
            verificationToken: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ConflictException if new email is already in use', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'other-user' }),
      });

      await expect(
        service.requestEmailChange('user123', 'taken@example.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      const rateLimitedUser = {
        ...mockUser,
        verificationChangeCount: {
          count: 3,
          resetAt: new Date(Date.now() + 86400000),
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(rateLimitedUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.requestEmailChange('user123', 'new@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.requestEmailChange('nonexistent', 'new@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyEmailChange', () => {
    it('should update email and invalidate sessions on valid token', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'old@example.com',
        pendingEmailChange: {
          newEmail: 'new@example.com',
          verificationToken: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockUser) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.verifyEmailChange('valid-token');

      expect(result.message).toContain('Email updated successfully');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          email: 'new@example.com',
          emailVerified: true,
        }),
      );
    });

    it('should notify old email after change', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'old@example.com',
        pendingEmailChange: {
          newEmail: 'new@example.com',
          verificationToken: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockUser) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockRedis.smembers.mockResolvedValue([]);

      await service.verifyEmailChange('valid-token');

      expect(mockEmailService.sendEmailChangeNotification).toHaveBeenCalledWith(
        'old@example.com',
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.verifyEmailChange('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'old@example.com',
        pendingEmailChange: {
          newEmail: 'new@example.com',
          verificationToken: 'expired-token',
          expiresAt: new Date(Date.now() - 1000),
        },
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await expect(service.verifyEmailChange('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestPhoneChange', () => {
    const mockUser = {
      _id: { toString: () => 'user123' },
      phone: '+923001234567',
      verificationChangeCount: { count: 0, resetAt: null },
    };

    it('should send OTP to new phone number', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.requestPhoneChange(
        'user123',
        '+923009876543',
      );

      expect(result.message).toContain('OTP sent');
      expect(mockSmsService.sendOtp).toHaveBeenCalledWith(
        '+923009876543',
        expect.any(String),
      );
    });

    it('should store pending phone change with hashed OTP', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.requestPhoneChange('user123', '+923009876543');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          pendingPhoneChange: expect.objectContaining({
            newPhone: '+923009876543',
            otpHash: expect.any(String),
            expiresAt: expect.any(Date),
            attempts: 0,
          }),
        }),
      );
    });

    it('should throw ConflictException if new phone is already in use', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'other-user' }),
      });

      await expect(
        service.requestPhoneChange('user123', '+923009876543'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      const rateLimitedUser = {
        ...mockUser,
        verificationChangeCount: {
          count: 3,
          resetAt: new Date(Date.now() + 86400000),
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(rateLimitedUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.requestPhoneChange('user123', '+923009876543'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyPhoneChange', () => {
    it('should update phone and invalidate sessions on valid OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = {
        _id: { toString: () => 'user123' },
        phone: '+923001234567',
        pendingPhoneChange: {
          newPhone: '+923009876543',
          otpHash,
          expiresAt: new Date(Date.now() + 600000),
          attempts: 0,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.verifyPhoneChange('user123', '123456');

      expect(result.message).toContain('Phone number updated successfully');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          phone: '+923009876543',
          phoneVerified: true,
        }),
      );
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = {
        _id: { toString: () => 'user123' },
        phone: '+923001234567',
        pendingPhoneChange: {
          newPhone: '+923009876543',
          otpHash,
          expiresAt: new Date(Date.now() + 600000),
          attempts: 0,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await expect(
        service.verifyPhoneChange('user123', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = {
        _id: { toString: () => 'user123' },
        phone: '+923001234567',
        pendingPhoneChange: {
          newPhone: '+923009876543',
          otpHash,
          expiresAt: new Date(Date.now() - 1000),
          attempts: 0,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await expect(
        service.verifyPhoneChange('user123', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no pending phone change', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        phone: '+923001234567',
        pendingPhoneChange: undefined,
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        service.verifyPhoneChange('user123', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if new phone is already taken at verify time', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = {
        _id: { toString: () => 'user123' },
        phone: '+923001234567',
        pendingPhoneChange: {
          newPhone: '+923009876543',
          otpHash,
          expiresAt: new Date(Date.now() + 600000),
          attempts: 0,
        },
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'other-user' }),
      });

      await expect(
        service.verifyPhoneChange('user123', '123456'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('checkUnverifiedAccounts', () => {
    it('should send reminder emails to unverified email users after 24 hours', async () => {
      const unverifiedUsers = [
        {
          email: 'unverified@example.com',
          emailVerified: false,
          phone: undefined,
          phoneVerified: false,
        },
      ];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(unverifiedUsers),
      });

      await service.checkUnverifiedAccounts();

      expect(mockEmailService.sendReminderEmail).toHaveBeenCalledWith(
        'unverified@example.com',
      );
    });

    it('should send reminder SMS to unverified phone users after 24 hours', async () => {
      const unverifiedUsers = [
        {
          email: undefined,
          emailVerified: false,
          phone: '+923001234567',
          phoneVerified: false,
        },
      ];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(unverifiedUsers),
      });

      await service.checkUnverifiedAccounts();

      expect(mockSmsService.sendReminderSms).toHaveBeenCalledWith(
        '+923001234567',
      );
    });

    it('should handle users with both unverified email and phone', async () => {
      const unverifiedUsers = [
        {
          email: 'both@example.com',
          emailVerified: false,
          phone: '+923001111111',
          phoneVerified: false,
        },
      ];
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(unverifiedUsers),
      });

      await service.checkUnverifiedAccounts();

      expect(mockEmailService.sendReminderEmail).toHaveBeenCalledWith(
        'both@example.com',
      );
      expect(mockSmsService.sendReminderSms).toHaveBeenCalledWith(
        '+923001111111',
      );
    });

    it('should not send reminders when no unverified accounts exist', async () => {
      mockUserModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.checkUnverifiedAccounts();

      expect(mockEmailService.sendReminderEmail).not.toHaveBeenCalled();
      expect(mockSmsService.sendReminderSms).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification - phone', () => {
    it('should resend phone verification OTP', async () => {
      const mockUser = {
        _id: 'user123',
        phone: '+923001234567',
        phoneVerified: false,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });
      mockVerificationTokenModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockVerificationTokenModel.create.mockResolvedValue({});

      const result = await service.resendVerification(
        undefined,
        '+923001234567',
      );
      expect(result.message).toContain('sent');
      expect(mockSmsService.sendOtp).toHaveBeenCalled();
    });

    it('should return generic success when phone is already verified', async () => {
      const mockUser = {
        _id: 'user123',
        phone: '+923001234567',
        phoneVerified: true,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.resendVerification(
        undefined,
        '+923001234567',
      );
      expect(result.message).toBe(
        'If an account exists, a verification will be sent.',
      );
    });

    it('should return generic success when email is already verified', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        emailVerified: true,
      };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.resendVerification('test@example.com');
      expect(result.message).toBe(
        'If an account exists, a verification will be sent.',
      );
    });

    it('should return generic success for unknown user', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.resendVerification('unknown@example.com');
      expect(result.message).toBe(
        'If an account exists, a verification will be sent.',
      );
    });

    it('should throw BadRequestException when neither email nor phone provided', async () => {
      await expect(
        service.resendVerification(undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail - edge cases', () => {
    it('should throw BadRequestException for expired email verification token', async () => {
      const mockRecord = {
        userId: 'user123',
        expiresAt: new Date(Date.now() - 1000),
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockVerificationTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRecord),
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyPhone - edge cases', () => {
    it('should throw BadRequestException for invalid OTP code', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = { _id: 'user123' };
      const mockRecord = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 600000),
        token: otpHash,
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      });

      await expect(
        service.verifyPhone('+923001234567', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired phone OTP', async () => {
      const otpHash = await bcrypt.hash('123456', 12);
      const mockUser = { _id: 'user123' };
      const mockRecord = {
        userId: 'user123',
        expiresAt: new Date(Date.now() - 1000),
        token: otpHash,
        used: false,
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockRecord),
        }),
      });

      await expect(
        service.verifyPhone('+923001234567', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no OTP record found', async () => {
      const mockUser = { _id: 'user123' };
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockVerificationTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.verifyPhone('+923001234567', '123456'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmailChange - edge cases', () => {
    it('should throw ConflictException if new email is already taken at verify time', async () => {
      const mockUser = {
        _id: { toString: () => 'user123' },
        email: 'old@example.com',
        pendingEmailChange: {
          newEmail: 'taken@example.com',
          verificationToken: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockUser) })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: 'other-user' }),
        });

      await expect(service.verifyEmailChange('valid-token')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('logout - edge cases', () => {
    it('should throw UnauthorizedException when token cannot be decoded at all', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      mockJwtService.decode.mockImplementation(() => {
        throw new Error('cannot decode');
      });

      await expect(
        service.logout('completely-invalid-token', 'user123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register - duplicate phone', () => {
    it('should throw ConflictException for duplicate phone number', async () => {
      mockUserModel.findOne
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) }) // email check passes
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ _id: 'existing' }),
        }); // phone check fails

      await expect(
        service.register({
          email: 'new@example.com',
          phone: '+923001234567',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
