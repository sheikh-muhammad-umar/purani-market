import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { FavoritesService } from './favorites.service';
import { Favorite } from './schemas/favorite.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';

describe('FavoritesService', () => {
  let service: FavoritesService;

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

  const mockListing = {
    _id: listingId,
    title: 'Test Listing',
    price: { amount: 1000, currency: 'PKR' },
    status: 'active',
    favoriteCount: 5,
  };

  let mockFavoriteModel: any;
  let mockListingModel: any;

  beforeEach(async () => {
    const saveFn = jest.fn().mockResolvedValue(mockFavorite);

    mockFavoriteModel = jest.fn().mockImplementation(() => ({
      save: saveFn,
    }));
    mockFavoriteModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockFavorite]),
          }),
        }),
      }),
    });
    mockFavoriteModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockFavorite),
    });
    mockFavoriteModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getModelToken(Favorite.name), useValue: mockFavoriteModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('addFavorite', () => {
    it('should add a favorite and increment listing favoriteCount', async () => {
      const result = await service.addFavorite(
        userId.toString(),
        listingId.toString(),
      );

      expect(result).toEqual(mockFavorite);
      expect(mockListingModel.findById).toHaveBeenCalledWith(
        listingId.toString(),
      );
      expect(mockListingModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(listingId.toString()) },
        { $inc: { favoriteCount: 1 } },
      );
    });

    it('should throw NotFoundException for invalid listing ID', async () => {
      await expect(
        service.addFavorite(userId.toString(), 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.addFavorite(userId.toString(), new Types.ObjectId().toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate favorite', async () => {
      const duplicateError = new Error('Duplicate key') as any;
      duplicateError.code = 11000;
      mockFavoriteModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(duplicateError),
      }));

      await expect(
        service.addFavorite(userId.toString(), listingId.toString()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException with descriptive message for duplicate', async () => {
      const duplicateError = new Error('Duplicate key') as any;
      duplicateError.code = 11000;
      mockFavoriteModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(duplicateError),
      }));

      await expect(
        service.addFavorite(userId.toString(), listingId.toString()),
      ).rejects.toThrow('Listing is already in your favorites');
    });

    it('should rethrow non-duplicate errors', async () => {
      const genericError = new Error('Database connection failed');
      mockFavoriteModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(genericError),
      }));

      await expect(
        service.addFavorite(userId.toString(), listingId.toString()),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getUserFavorites', () => {
    it('should return user favorites with populated listing data', async () => {
      const result = await service.getUserFavorites(userId.toString());

      expect(result).toEqual([mockFavorite]);
      expect(mockFavoriteModel.find).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId.toString()),
      });
    });

    it('should populate listing with status and price fields (Req 25.2)', async () => {
      await service.getUserFavorites(userId.toString());

      const populateCall = mockFavoriteModel.find().populate;
      expect(populateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'productListingId',
          select: expect.stringContaining('price'),
        }),
      );
      expect(populateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.stringContaining('status'),
        }),
      );
    });

    it('should sort favorites by createdAt descending', async () => {
      await service.getUserFavorites(userId.toString());

      const sortCall = mockFavoriteModel.find().populate().sort;
      expect(sortCall).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('removeFavorite', () => {
    it('should remove a favorite and decrement listing favoriteCount', async () => {
      await service.removeFavorite(favoriteId.toString(), userId.toString());

      expect(mockFavoriteModel.deleteOne).toHaveBeenCalledWith({
        _id: mockFavorite._id,
      });
      expect(mockListingModel.updateOne).toHaveBeenCalledWith(
        { _id: mockFavorite.productListingId },
        { $inc: { favoriteCount: -1 } },
      );
    });

    it('should throw NotFoundException for invalid favorite ID', async () => {
      await expect(
        service.removeFavorite('invalid-id', userId.toString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when favorite does not exist', async () => {
      mockFavoriteModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.removeFavorite(
          new Types.ObjectId().toString(),
          userId.toString(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the favorite', async () => {
      await expect(
        service.removeFavorite(favoriteId.toString(), otherUserId.toString()),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
