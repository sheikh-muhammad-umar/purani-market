import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { Types } from 'mongoose';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: Record<string, jest.Mock>;

  const userId = new Types.ObjectId();
  const mockUser = {
    _id: userId,
    email: 'test@example.com',
    phone: '+923001234567',
    passwordHash: 'hashed_password',
    role: 'buyer',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      avatar: '',
      city: 'Lahore',
      postalCode: '54000',
    },
    emailVerified: true,
    phoneVerified: false,
    mfa: { enabled: false, failedAttempts: 0, totpSecret: 'secret123' },
    notificationPreferences: {
      messages: true,
      offers: true,
      productUpdates: true,
      promotions: true,
      packageAlerts: true,
    },
    socialLogins: [],
    deviceTokens: [],
    adLimit: 10,
    activeAdCount: 0,
    status: 'active',
    __v: 0,
    toObject: function () {
      return { ...this };
    },
  };

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUser) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUser) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUser) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const result = await service.findById(userId);
      expect(result).toBe(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const result = await service.findByEmail('test@example.com');
      expect(result).toBe(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return null when no user found', async () => {
      mockUserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await service.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findByPhone', () => {
    it('should return a user by phone', async () => {
      const result = await service.findByPhone('+923001234567');
      expect(result).toBe(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ phone: '+923001234567' });
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      const dto = { firstName: 'Jane', city: 'Karachi' };
      await service.updateProfile(userId, dto);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $set: { 'profile.firstName': 'Jane', 'profile.city': 'Karachi' } },
        { new: true },
      );
    });

    it('should update location with default type', async () => {
      const dto = { location: { coordinates: [74.35, 31.55] } };
      await service.updateProfile(userId, dto);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        {
          $set: {
            'profile.location': { type: 'Point', coordinates: [74.35, 31.55] },
          },
        },
        { new: true },
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.updateProfile(userId, { firstName: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('sanitizeUser', () => {
    it('should remove passwordHash, __v, and mfa.totpSecret', () => {
      const result = service.sanitizeUser(mockUser as any);
      expect(result['passwordHash']).toBeUndefined();
      expect(result['__v']).toBeUndefined();
      expect((result['mfa'] as any)?.totpSecret).toBeUndefined();
    });

    it('should keep other fields intact', () => {
      const result = service.sanitizeUser(mockUser as any);
      expect(result['email']).toBe('test@example.com');
      expect(result['role']).toBe('buyer');
      expect((result['profile'] as any).firstName).toBe('John');
    });
  });
});
