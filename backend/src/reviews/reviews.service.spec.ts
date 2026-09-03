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
import { User } from '../users/schemas/user.schema';
import { StorageService } from '../listings/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../auth/services/email.service';

/** Build a chainable query mock resolving `find().populate()...exec()`. */
function findChain(result: unknown) {
  const chain: any = {};
  for (const m of ['find', 'populate', 'sort', 'limit']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.exec = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('ReviewsService', () => {
  let service: ReviewsService;

  const buyerId = new Types.ObjectId();
  const sellerId = new Types.ObjectId();
  const listingId = new Types.ObjectId();
  const reviewId = new Types.ObjectId();

  const mockListing = { _id: listingId, sellerId, title: 'Test Listing' };
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
    images: [],
    status: ReviewStatus.APPROVED,
    createdAt: new Date(),
  };

  let mockReviewModel: any;
  let mockListingModel: any;
  let mockUserModel: any;
  let mockConversationModel: any;
  let storage: { saveFile: jest.Mock; deleteFile: jest.Mock };
  let notifications: {
    sendReviewApprovedNotification: jest.Mock;
    sendReviewRejectedNotification: jest.Mock;
  };
  let email: {
    sendReviewApprovedEmail: jest.Mock;
    sendReviewRejectedEmail: jest.Mock;
  };
  let saveFn: jest.Mock;

  beforeEach(async () => {
    saveFn = jest.fn().mockResolvedValue(mockReview);

    mockReviewModel = jest.fn().mockImplementation(() => ({ save: saveFn }));
    mockReviewModel.find = jest.fn().mockReturnValue(findChain([mockReview]));
    mockReviewModel.findById = jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    mockReviewModel.countDocuments = jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
    mockReviewModel.aggregate = jest.fn().mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([{ _id: null, averageRating: 4.5, reviewCount: 2 }]),
    });
    mockReviewModel.updateMany = jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    mockReviewModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockListingModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockListing),
      }),
      updateMany: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    mockUserModel = {
      // Seller-existence check in createReview.
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: sellerId }),
      }),
      updateOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    mockConversationModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockConversation),
      }),
    };

    storage = {
      saveFile: jest
        .fn()
        .mockResolvedValue({ fileUrl: 'http://x/y.png', key: 'reviews/y.png' }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      sendReviewApprovedNotification: jest.fn().mockResolvedValue(true),
      sendReviewRejectedNotification: jest.fn().mockResolvedValue(true),
    };
    email = {
      sendReviewApprovedEmail: jest.fn().mockResolvedValue(undefined),
      sendReviewRejectedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getModelToken(Review.name), useValue: mockReviewModel },
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken('Conversation'),
          useValue: mockConversationModel,
        },
        { provide: StorageService, useValue: storage },
        { provide: NotificationsService, useValue: notifications },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('createReview', () => {
    const dto = {
      sellerId: sellerId.toString(),
      productListingId: listingId.toString(),
      rating: 4,
      text: 'Great seller!',
    };

    it('creates a review when the buyer has messaged the seller', async () => {
      const result = await service.createReview(buyerId.toString(), dto);
      expect(result).toEqual(mockReview);
      // Gated on a buyer<->seller conversation (not listing-specific).
      expect(mockConversationModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ buyerId, sellerId }),
      );
    });

    it('saves attached images and stores their {url,key}', async () => {
      const files = [
        { originalname: 'a.png', buffer: Buffer.from('x') },
      ] as any;
      await service.createReview(buyerId.toString(), dto, files);
      expect(storage.saveFile).toHaveBeenCalledTimes(1);
      const built = mockReviewModel.mock.calls[0][0];
      expect(built.images).toEqual([
        { url: 'http://x/y.png', key: 'reviews/y.png' },
      ]);
      expect(built.sellerId.toString()).toBe(sellerId.toString());
    });

    it('creates the review as PENDING and does not touch the rating yet', async () => {
      await service.createReview(buyerId.toString(), dto);
      const built = mockReviewModel.mock.calls[0][0];
      expect(built.status).toBe(ReviewStatus.PENDING);
      // Nothing is published on submit, so the rating is untouched until approval.
      expect(mockUserModel.updateOne).not.toHaveBeenCalled();
      expect(mockListingModel.updateMany).not.toHaveBeenCalled();
    });

    it('creates a review without a listing context', async () => {
      const { productListingId, ...noListing } = dto;
      const result = await service.createReview(buyerId.toString(), noListing);
      expect(result).toEqual(mockReview);
      // No listing lookup happens when none is provided.
      expect(mockListingModel.findById).not.toHaveBeenCalled();
      const built = mockReviewModel.mock.calls[0][0];
      expect(built.productListingId).toBeUndefined();
    });

    it('throws NotFoundException for an invalid seller id', async () => {
      await expect(
        service.createReview(buyerId.toString(), {
          ...dto,
          sellerId: 'invalid-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the seller does not exist', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.createReview(buyerId.toString(), {
          ...dto,
          sellerId: new Types.ObjectId().toString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('forbids reviewing yourself', async () => {
      await expect(
        service.createReview(sellerId.toString(), dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when no conversation with the seller exists', async () => {
      mockConversationModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.createReview(buyerId.toString(), dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws Conflict and cleans up images when already reviewed this seller', async () => {
      const dupErr = Object.assign(new Error('dup'), { code: 11000 });
      saveFn.mockRejectedValueOnce(dupErr);
      const files = [
        { originalname: 'a.png', buffer: Buffer.from('x') },
      ] as any;
      await expect(
        service.createReview(buyerId.toString(), dto, files),
      ).rejects.toThrow(ConflictException);
      expect(storage.deleteFile).toHaveBeenCalledWith('reviews/y.png');
    });

    it('always starts pending regardless of content (admin must approve)', async () => {
      const pending = { ...mockReview, status: ReviewStatus.PENDING };
      saveFn.mockResolvedValueOnce(pending);
      const result = await service.createReview(buyerId.toString(), dto);
      expect(result.status).toBe(ReviewStatus.PENDING);
      // Pending reviews are not visible, so the seller rating is not touched.
      expect(mockUserModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('getReviewsByListing', () => {
    it('returns {data,total,averageRating} for a listing', async () => {
      // The listing aggregation groups the average under `avg`.
      mockReviewModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: null, avg: 4.5 }]),
      });
      const result = await service.getReviewsByListing(listingId.toString());
      expect(result.data).toEqual([mockReview]);
      expect(result.total).toBe(1);
      expect(result.averageRating).toBe(4.5);
    });

    it('throws NotFoundException for an invalid listing id', async () => {
      await expect(service.getReviewsByListing('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReviewsBySeller', () => {
    it('returns {data,total,averageRating} for a seller', async () => {
      const result = await service.getReviewsBySeller(sellerId.toString());
      expect(result.data).toEqual([mockReview]);
      expect(result.total).toBe(1);
      expect(result.averageRating).toBe(4.5);
    });

    it('throws NotFoundException for an invalid seller id', async () => {
      await expect(service.getReviewsBySeller('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('computeRatingStats', () => {
    it('rounds the average to 1 decimal and returns the count', async () => {
      const stats = await service.computeRatingStats(sellerId.toString());
      expect(stats).toEqual({ averageRating: 4.5, reviewCount: 2 });
    });

    it('returns zeros when the seller has no reviews', async () => {
      mockReviewModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      const stats = await service.computeRatingStats(sellerId.toString());
      expect(stats).toEqual({ averageRating: 0, reviewCount: 0 });
    });
  });

  // Lets fire-and-forget notification promises settle before assertions.
  const flush = () => new Promise((r) => setImmediate(r));
  const adminId = new Types.ObjectId().toString();

  describe('approveReview', () => {
    it('publishes the review, refreshes the rating, and notifies the reviewer', async () => {
      const reviewDoc: any = {
        _id: reviewId,
        sellerId,
        reviewerId: buyerId,
        status: ReviewStatus.PENDING,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockReviewModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(reviewDoc),
      });

      const result = await service.approveReview(reviewId.toString(), adminId);
      await flush();

      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(reviewDoc.save).toHaveBeenCalled();
      expect(mockUserModel.updateOne).toHaveBeenCalled(); // rating refresh
      expect(notifications.sendReviewApprovedNotification).toHaveBeenCalled();
    });

    it('is a no-op when the review is already approved', async () => {
      const reviewDoc: any = {
        _id: reviewId,
        sellerId,
        reviewerId: buyerId,
        status: ReviewStatus.APPROVED,
        save: jest.fn(),
      };
      mockReviewModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(reviewDoc),
      });
      await service.approveReview(reviewId.toString(), adminId);
      expect(reviewDoc.save).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing review', async () => {
      mockReviewModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.approveReview(reviewId.toString(), adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectReview', () => {
    it('deletes the review + its images, refreshes the rating, and notifies', async () => {
      const reviewDoc: any = {
        _id: reviewId,
        sellerId,
        reviewerId: buyerId,
        status: ReviewStatus.PENDING,
        images: [{ url: 'http://x/y.png', key: 'reviews/y.png' }],
      };
      mockReviewModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(reviewDoc),
      });

      const result = await service.rejectReview(
        reviewId.toString(),
        adminId,
        'Spam',
      );
      await flush();

      expect(result).toEqual({ deleted: true });
      expect(mockReviewModel.deleteOne).toHaveBeenCalledWith({ _id: reviewId });
      expect(storage.deleteFile).toHaveBeenCalledWith('reviews/y.png');
      expect(mockUserModel.updateOne).toHaveBeenCalled(); // rating refresh
      expect(notifications.sendReviewRejectedNotification).toHaveBeenCalled();
    });

    it('throws NotFound for a missing review', async () => {
      mockReviewModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.rejectReview(reviewId.toString(), adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllReviews', () => {
    it('returns paginated data with a total', async () => {
      mockReviewModel.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ total: 3 }]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]),
        });
      const result = await service.getAllReviews({ page: 1, limit: 20 });
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('containsProhibitedContent', () => {
    it('detects prohibited words', () => {
      expect(service.containsProhibitedContent('This is a scam')).toBe(true);
      expect(service.containsProhibitedContent('Total fraud')).toBe(true);
    });
    it('returns false for clean text', () => {
      expect(service.containsProhibitedContent('Great product!')).toBe(false);
    });
  });
});
