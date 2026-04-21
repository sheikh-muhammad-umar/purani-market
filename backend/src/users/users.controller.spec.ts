import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Types } from 'mongoose';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findById: jest.Mock;
    updateProfile: jest.Mock;
    sanitizeUser: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const sanitizedUser = {
    _id: userId,
    email: 'test@example.com',
    role: 'buyer',
    profile: { firstName: 'John', lastName: 'Doe' },
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
      sanitizeUser: jest.fn().mockReturnValue(sanitizedUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('GET /api/users/me', () => {
    it('should return the sanitized current user', async () => {
      const mockDoc = { _id: userId };
      usersService.findById.mockResolvedValue(mockDoc);

      const result = await controller.getMe(userId);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(usersService.sanitizeUser).toHaveBeenCalledWith(mockDoc);
      expect(result).toEqual(sanitizedUser);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update profile and return sanitized user', async () => {
      const dto = { firstName: 'Jane', city: 'Karachi' };
      const mockDoc = { _id: userId };
      usersService.updateProfile.mockResolvedValue(mockDoc);

      const result = await controller.updateMe(userId, dto);

      expect(usersService.updateProfile).toHaveBeenCalledWith(userId, dto);
      expect(usersService.sanitizeUser).toHaveBeenCalledWith(mockDoc);
      expect(result).toEqual(sanitizedUser);
    });
  });
});
