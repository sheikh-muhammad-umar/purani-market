import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let mockFavoritesService: Partial<Record<keyof FavoritesService, jest.Mock>>;

  const userId = new Types.ObjectId();
  const otherUserId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const favoriteId = new Types.ObjectId();

  const mockFavorite = {
    _id: favoriteId,
    userId,
    productListingId: listingId,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockFavoritesService = {
      addFavorite: jest.fn().mockResolvedValue(mockFavorite),
      getUserFavorites: jest.fn().mockResolvedValue([mockFavorite]),
      removeFavorite: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: mockFavoritesService },
        Reflector,
      ],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
  });

  describe('addFavorite', () => {
    it('should add a favorite and return it', async () => {
      const result = await controller.addFavorite(userId.toString(), {
        productListingId: listingId.toString(),
      });

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledWith(
        userId.toString(),
        listingId.toString(),
      );
      expect(result).toBe(mockFavorite);
    });

    it('should propagate ConflictException for duplicate', async () => {
      mockFavoritesService.addFavorite!.mockRejectedValue(
        new ConflictException('Listing is already in your favorites'),
      );

      await expect(
        controller.addFavorite(userId.toString(), {
          productListingId: listingId.toString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate NotFoundException for missing listing', async () => {
      mockFavoritesService.addFavorite!.mockRejectedValue(
        new NotFoundException('Listing not found'),
      );

      await expect(
        controller.addFavorite(userId.toString(), {
          productListingId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserFavorites', () => {
    it('should return user favorites', async () => {
      const result = await controller.getUserFavorites(userId.toString());

      expect(mockFavoritesService.getUserFavorites).toHaveBeenCalledWith(
        userId.toString(),
      );
      expect(result).toEqual([mockFavorite]);
    });
  });

  describe('removeFavorite', () => {
    it('should remove a favorite and return success message', async () => {
      const result = await controller.removeFavorite(
        favoriteId.toString(),
        userId.toString(),
      );

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(
        favoriteId.toString(),
        userId.toString(),
      );
      expect(result).toEqual({ message: 'Favorite removed successfully' });
    });

    it('should propagate ForbiddenException for non-owner', async () => {
      mockFavoritesService.removeFavorite!.mockRejectedValue(
        new ForbiddenException('You are not authorized to remove this favorite'),
      );

      await expect(
        controller.removeFavorite(favoriteId.toString(), otherUserId.toString()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException for missing favorite', async () => {
      mockFavoritesService.removeFavorite!.mockRejectedValue(
        new NotFoundException('Favorite not found'),
      );

      await expect(
        controller.removeFavorite(
          new Types.ObjectId().toString(),
          userId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
