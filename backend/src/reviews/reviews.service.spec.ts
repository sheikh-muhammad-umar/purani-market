import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ReviewsService } from './reviews.service';
import { Review, ReviewStatus } from './schemas/review.schema';
import { ProductListing } from '../listings/schemas/product-listing.schema';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const buyerId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const reviewId = new Types.ObjectId();

  const mockListing = {
    _id: listingId,
    sellerId,
    title: 'Test Listing',
  };

  const mockConversation = {
    _id: new Types.ObjectId(),
    buyerId,
    sellerId,
    productListingId: listingId,
  };

  const mockReview = {
    _id: reviewId,
    reviewerId: buyerId,
    sellerId,
    productListingId: listingId,
    rating: 4,
    text: 'Great seller!',
    status: ReviewStatus.APPROVED,
    createdAt: new Date(),
  };

  let mockReviewModel: any;
  let mockListingModel: any;
  let mockConversationModel: any;

  beforeEach(async () => {
    const saveFn = jest.fn().mockResolvedValue(mockReview);

    mockReviewModel = jest.fn().mockImplementation(() => ({
      save: saveFn,
    }));
    mockReviewModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockReview]),
          }),
        }),
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockReview]),
            }),
          }),
        }),
      }),
    });
    mockReviewModel.aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: null, averageRating: 4.5 }]),
    });

    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockListing),
      }),
    };

    mockConversationModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversation),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getModelToken(Review.name), useValue: mockReviewModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        {
          provide: getModelToken('Conversation'),
          useValue: mockConversationModel,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('createReview', () => {
    it('should create a review when buyer has a conversation with seller', async () => {
      const result = await service.createReview(buyerId.toString(), {
        productListingId: listingId.toString(),
        rating: 4,
        text: 'Great seller!',
      });

      expect(result).toEqual(mockReview);
      expect(mockConversationModel.findOne).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid listing ID', async () => {
      await expect(
        service.createReview(buyerId.toString(), {
          productListingId: 'invalid-id',
          rating: 4,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockListingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createReview(buyerId.toString(), {
          productListingId: new Types.ObjectId().toString(),
          rating: 4,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when seller tries to review own listing', async () => {
      await expect(
        service.createReview(sellerId.toString(), {
          productListingId: listingId.toString(),
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when no conversation exists', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createReview(buyerId.toString(), {
          productListingId: listingId.toString(),
          rating: 4,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate review', async () => {
      const duplicateError = new Error('Duplicate key') as any;
      duplicateError.code = 11000;
      mockReviewModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(duplicateError),
      }));

      await expect(
        service.createReview(buyerId.toString(), {
          productListingId: listingId.toString(),
          rating: 4,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should flag review with prohibited content as pending', async () => {
      const pendingReview = { ...mockReview, status: ReviewStatus.PENDING };
      mockReviewModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(pendingReview),
      }));

      const result = await service.createReview(buyerId.toString(), {
        productListingId: listingId.toString(),
        rating: 3,
        text: 'This is a scam product',
      });

      expect(result.status).toBe(ReviewStatus.PENDING);
    });
  });

  describe('getReviewsByListing', () => {
    it('should return approved reviews for a listing sorted by most recent', async () => {
      const result = await service.getReviewsByListing(listingId.toString());

      expect(result).toEqual([mockReview]);
      expect(mockReviewModel.find).toHaveBeenCalledWith({
        productListingId: new Types.ObjectId(listingId.toString()),
        status: ReviewStatus.APPROVED,
      });
    });

    it('should throw NotFoundException for invalid listing ID', async () => {
      await expect(service.getReviewsByListing('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReviewsBySeller', () => {
    it('should return reviews with average rating for a seller', async () => {
      const result = await service.getReviewsBySeller(sellerId.toString());

      expect(result.reviews).toEqual([mockReview]);
      expect(result.averageRating).toBe(4.5);
      expect(result.totalReviews).toBe(1);
    });

    it('should throw NotFoundException for invalid seller ID', async () => {
      await expect(service.getReviewsBySeller('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('calculateAverageRating', () => {
    it('should return average rating rounded to 1 decimal', async () => {
      const result = await service.calculateAverageRating(sellerId.toString());
      expect(result).toBe(4.5);
    });

    it('should return 0 when seller has no reviews', async () => {
      mockReviewModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.calculateAverageRating(sellerId.toString());
      expect(result).toBe(0);
    });
  });

  describe('containsProhibitedContent', () => {
    it('should detect prohibited words', () => {
      expect(service.containsProhibitedContent('This is a scam')).toBe(true);
      expect(service.containsProhibitedContent('Total fraud')).toBe(true);
      expect(service.containsProhibitedContent('SPAM content')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(service.containsProhibitedContent('Great product!')).toBe(false);
      expect(service.containsProhibitedContent('Excellent seller')).toBe(false);
    });
  });
});
