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
import { AdminTrackerService } from '../ai/admin-tracker.service';
import { UserAction } from '../ai/schemas/user-activity.schema';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let mockReviewsService: Partial<Record<keyof ReviewsService, jest.Mock>>;
  let tracker: { track: jest.Mock };

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

  const dto = {
    sellerId: sellerId.toString(),
    productListingId: listingId.toString(),
    rating: 4,
    text: 'Great seller!',
  };

  beforeEach(async () => {
    mockReviewsService = {
      createReview: jest.fn().mockResolvedValue(mockReview),
      getReviewsByListing: jest
        .fn()
        .mockResolvedValue({ data: [mockReview], total: 1, averageRating: 4 }),
      getReviewsBySeller: jest
        .fn()
        .mockResolvedValue({ data: [mockReview], total: 1, averageRating: 4 }),
      getAllReviews: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getReviewById: jest.fn().mockResolvedValue(mockReview),
      approveReview: jest.fn().mockResolvedValue(mockReview),
      rejectReview: jest.fn().mockResolvedValue({ deleted: true }),
    };
    tracker = { track: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: AdminTrackerService, useValue: tracker },
        Reflector,
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  describe('createReview', () => {
    it('creates a review with images and tracks REVIEW_CREATE', async () => {
      const files = [
        { originalname: 'a.png', buffer: Buffer.from('x') },
      ] as any;
      const result = await controller.createReview(
        buyerId.toString(),
        dto as any,
        files,
        {},
      );

      expect(mockReviewsService.createReview).toHaveBeenCalledWith(
        buyerId.toString(),
        dto,
        files,
      );
      expect(result).toBe(mockReview);
      expect(tracker.track).toHaveBeenCalledWith(
        buyerId.toString(),
        UserAction.REVIEW_CREATE,
        expect.objectContaining({ hasImages: true }),
        expect.anything(),
      );
    });

    it('defaults images to an empty array', async () => {
      await controller.createReview(
        buyerId.toString(),
        dto as any,
        undefined as any,
        {},
      );
      expect(mockReviewsService.createReview).toHaveBeenCalledWith(
        buyerId.toString(),
        dto,
        [],
      );
    });

    it('propagates BadRequestException when no conversation exists', async () => {
      mockReviewsService.createReview!.mockRejectedValue(
        new BadRequestException('no conversation'),
      );
      await expect(
        controller.createReview(buyerId.toString(), dto as any, [], {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates ConflictException for a duplicate review', async () => {
      mockReviewsService.createReview!.mockRejectedValue(
        new ConflictException('duplicate'),
      );
      await expect(
        controller.createReview(buyerId.toString(), dto as any, [], {}),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('read endpoints', () => {
    it('returns reviews for a listing', async () => {
      const result = await controller.getReviewsByListing(
        listingId.toString(),
        20,
      );
      expect(mockReviewsService.getReviewsByListing).toHaveBeenCalledWith(
        listingId.toString(),
        20,
      );
      expect(result).toEqual({
        data: [mockReview],
        total: 1,
        averageRating: 4,
      });
    });

    it('returns reviews with average for a seller', async () => {
      const result = await controller.getReviewsBySeller(
        sellerId.toString(),
        20,
      );
      expect(result.averageRating).toBe(4);
    });

    it('propagates NotFoundException for an invalid listing', async () => {
      mockReviewsService.getReviewsByListing!.mockRejectedValue(
        new NotFoundException('not found'),
      );
      await expect(
        controller.getReviewsByListing('invalid-id', 20),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('admin moderation', () => {
    it('lists reviews via the query dto', async () => {
      await controller.getAllReviews({
        page: 1,
        limit: 10,
        status: ReviewStatus.PENDING,
      } as any);
      expect(mockReviewsService.getAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.PENDING }),
      );
    });

    it('gets a review detail', async () => {
      await controller.getReviewDetail(reviewId.toString());
      expect(mockReviewsService.getReviewById).toHaveBeenCalledWith(
        reviewId.toString(),
      );
    });

    it('approving calls approveReview and tracks ADMIN_REVIEW_APPROVE', async () => {
      const result = await controller.moderateReview(
        reviewId.toString(),
        'admin-1',
        { status: ReviewStatus.APPROVED } as any,
        {},
      );
      expect(mockReviewsService.approveReview).toHaveBeenCalledWith(
        reviewId.toString(),
        'admin-1',
      );
      expect(mockReviewsService.rejectReview).not.toHaveBeenCalled();
      expect(result).toBe(mockReview);
      expect(tracker.track).toHaveBeenCalledWith(
        'admin-1',
        UserAction.ADMIN_REVIEW_APPROVE,
        expect.any(Object),
        expect.anything(),
      );
    });

    it('rejecting deletes the review and tracks ADMIN_REVIEW_REJECT', async () => {
      const result = await controller.moderateReview(
        reviewId.toString(),
        'admin-1',
        { status: ReviewStatus.REJECTED, moderationNote: 'spam' } as any,
        {},
      );
      expect(mockReviewsService.rejectReview).toHaveBeenCalledWith(
        reviewId.toString(),
        'admin-1',
        'spam',
      );
      expect(mockReviewsService.approveReview).not.toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
      expect(tracker.track).toHaveBeenCalledWith(
        'admin-1',
        UserAction.ADMIN_REVIEW_REJECT,
        expect.objectContaining({ deleted: true }),
        expect.anything(),
      );
    });
  });
});
