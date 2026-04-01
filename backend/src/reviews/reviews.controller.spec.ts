import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewStatus } from './schemas/review.schema';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let mockReviewsService: Partial<Record<keyof ReviewsService, jest.Mock>>;

  const buyerId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const reviewId = new Types.ObjectId();

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

  beforeEach(async () => {
    mockReviewsService = {
      createReview: jest.fn().mockResolvedValue(mockReview),
      getReviewsByListing: jest.fn().mockResolvedValue([mockReview]),
      getReviewsBySeller: jest.fn().mockResolvedValue({
        reviews: [mockReview],
        averageRating: 4.0,
        totalReviews: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
        Reflector,
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  describe('createReview', () => {
    it('should create a review and return it', async () => {
      const result = await controller.createReview(buyerId.toString(), {
        productListingId: listingId.toString(),
        rating: 4,
        text: 'Great seller!',
      });

      expect(mockReviewsService.createReview).toHaveBeenCalledWith(
        buyerId.toString(),
        {
          productListingId: listingId.toString(),
          rating: 4,
          text: 'Great seller!',
        },
      );
      expect(result).toBe(mockReview);
    });

    it('should propagate BadRequestException when no conversation exists', async () => {
      mockReviewsService.createReview!.mockRejectedValue(
        new BadRequestException('You must have a conversation with the seller'),
      );

      await expect(
        controller.createReview(buyerId.toString(), {
          productListingId: listingId.toString(),
          rating: 4,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate ConflictException for duplicate review', async () => {
      mockReviewsService.createReview!.mockRejectedValue(
        new ConflictException('You have already reviewed this listing'),
      );

      await expect(
        controller.createReview(buyerId.toString(), {
          productListingId: listingId.toString(),
          rating: 4,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReviewsByListing', () => {
    it('should return reviews for a listing', async () => {
      const result = await controller.getReviewsByListing(listingId.toString());

      expect(mockReviewsService.getReviewsByListing).toHaveBeenCalledWith(
        listingId.toString(),
      );
      expect(result).toEqual([mockReview]);
    });

    it('should propagate NotFoundException for invalid listing', async () => {
      mockReviewsService.getReviewsByListing!.mockRejectedValue(
        new NotFoundException('Listing not found'),
      );

      await expect(
        controller.getReviewsByListing('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReviewsBySeller', () => {
    it('should return reviews with average rating for a seller', async () => {
      const result = await controller.getReviewsBySeller(sellerId.toString());

      expect(mockReviewsService.getReviewsBySeller).toHaveBeenCalledWith(
        sellerId.toString(),
      );
      expect(result).toEqual({
        reviews: [mockReview],
        averageRating: 4.0,
        totalReviews: 1,
      });
    });
  });
});
