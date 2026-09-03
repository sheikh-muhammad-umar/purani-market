import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
  ReviewImage,
} from './schemas/review.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { User, UserDocument } from '../users/schemas/user.schema.js';
import { StorageService } from '../listings/storage.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EmailService } from '../auth/services/email.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ERROR } from '../common/constants/error-messages.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import { PROHIBITED_WORDS } from '../common/constants/app.constants.js';
import { containsRegex } from '../common/utils/sanitize-regex.js';

const UPLOAD_FOLDER = 'reviews';

export interface PaginatedReviews {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel('Conversation')
    private readonly conversationModel: Model<any>,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async createReview(
    reviewerId: string,
    dto: CreateReviewDto,
    images: Express.Multer.File[] = [],
  ): Promise<ReviewDocument> {
    const { sellerId, productListingId, rating, text } = dto;

    if (!Types.ObjectId.isValid(sellerId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // Can't review yourself.
    if (sellerId === reviewerId) {
      throw new ForbiddenException(PUBLIC_ERROR.REVIEW_FAILED);
    }

    const sellerOid = new Types.ObjectId(sellerId);

    const seller = await this.userModel
      .findById(sellerOid)
      .select('_id')
      .lean()
      .exec();
    if (!seller) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    // The reviewer must have actually dealt with this seller: require at least
    // one conversation between them. Keyed on the pair, not a listing, since
    // the review is about the seller.
    const conversation = await this.conversationModel
      .findOne({
        buyerId: new Types.ObjectId(reviewerId),
        sellerId: sellerOid,
      })
      .exec();

    if (!conversation) {
      throw new BadRequestException(PUBLIC_ERROR.REVIEW_FAILED);
    }

    // Optional listing context — validate it belongs to the seller if given,
    // but it's not required and isn't what the review is keyed on.
    let listingOid: Types.ObjectId | undefined;
    if (productListingId) {
      const listing = await this.listingModel
        .findById(productListingId)
        .select('_id sellerId')
        .lean()
        .exec();
      if (listing && listing.sellerId.toString() === sellerId) {
        listingOid = new Types.ObjectId(productListingId);
      }
    }

    // Every review starts pending and only goes live once an admin approves it.
    // (Nothing is published on submit, so the seller's rating isn't touched
    // here — it's recomputed on approval.)
    const savedImages = await this.saveImages(images);

    let review: ReviewDocument;
    try {
      review = await new this.reviewModel({
        reviewerId: new Types.ObjectId(reviewerId),
        sellerId: sellerOid,
        productListingId: listingOid,
        rating,
        text,
        images: savedImages,
        status: ReviewStatus.PENDING,
      }).save();
    } catch (error: any) {
      if (error.code === 11000) {
        // Already reviewed this seller: clean up the uploaded files.
        await this.cleanupImages(savedImages);
        throw new ConflictException(PUBLIC_ERROR.REVIEW_FAILED);
      }
      await this.cleanupImages(savedImages);
      throw error;
    }

    return review;
  }

  private async saveImages(
    files: Express.Multer.File[],
  ): Promise<ReviewImage[]> {
    if (!files.length) return [];
    const results = await Promise.all(
      files.map((f) =>
        this.storageService.saveFile(UPLOAD_FOLDER, f.originalname, f.buffer),
      ),
    );
    return results.map((r) => ({ url: r.fileUrl, key: r.key }));
  }

  private async cleanupImages(images: ReviewImage[]): Promise<void> {
    await Promise.all(
      images.map((img) =>
        this.storageService.deleteFile(img.key).catch(() => undefined),
      ),
    );
  }

  async getReviewsByListing(
    listingId: string,
    limit = 20,
  ): Promise<{
    data: ReviewDocument[];
    averageRating: number;
    total: number;
  }> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const filter = {
      productListingId: new Types.ObjectId(listingId),
      status: ReviewStatus.APPROVED,
    };

    const [data, total, agg] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate(
          'reviewerId',
          'profile.firstName profile.lastName profile.avatar',
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.reviewModel
        .aggregate([
          { $match: filter },
          { $group: { _id: null, avg: { $avg: '$rating' } } },
        ])
        .exec(),
    ]);

    return {
      data,
      total,
      averageRating: agg.length ? Math.round(agg[0].avg * 10) / 10 : 0,
    };
  }

  async getReviewsBySeller(
    sellerId: string,
    limit = 20,
  ): Promise<{
    data: ReviewDocument[];
    averageRating: number;
    total: number;
  }> {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const filter = {
      sellerId: new Types.ObjectId(sellerId),
      status: ReviewStatus.APPROVED,
    };

    const [data, total, stats] = await Promise.all([
      this.reviewModel
        .find(filter)
        .populate(
          'reviewerId',
          'profile.firstName profile.lastName profile.avatar',
        )
        .populate('productListingId', 'title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.computeRatingStats(sellerId),
    ]);

    return { data, total, averageRating: stats.averageRating };
  }

  /** Average (1 dp) and count of a seller's APPROVED reviews. */
  async computeRatingStats(
    sellerId: string,
  ): Promise<{ averageRating: number; reviewCount: number }> {
    const result = await this.reviewModel
      .aggregate([
        {
          $match: {
            sellerId: new Types.ObjectId(sellerId),
            status: ReviewStatus.APPROVED,
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!result.length) return { averageRating: 0, reviewCount: 0 };
    return {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      reviewCount: result[0].reviewCount,
    };
  }

  /** Kept for backward compatibility; delegates to computeRatingStats. */
  async calculateAverageRating(sellerId: string): Promise<number> {
    return (await this.computeRatingStats(sellerId)).averageRating;
  }

  /**
   * Recompute a seller's denormalized rating and mirror it onto the seller's
   * User doc AND their listings, so cards/profiles show a fresh rating without
   * an aggregation per render. Best-effort: a failure here must not fail the
   * user-facing review action, so callers may ignore rejections.
   */
  async refreshSellerRating(sellerId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sellerId)) return;
    const { averageRating, reviewCount } =
      await this.computeRatingStats(sellerId);
    const sellerOid = new Types.ObjectId(sellerId);

    await Promise.all([
      this.userModel
        .updateOne({ _id: sellerOid }, { $set: { averageRating, reviewCount } })
        .exec(),
      this.listingModel
        .updateMany(
          { sellerId: sellerOid },
          {
            $set: {
              sellerRating: averageRating,
              sellerReviewCount: reviewCount,
            },
          },
        )
        .exec(),
    ]);
  }

  containsProhibitedContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    return PROHIBITED_WORDS.some((word) => lowerText.includes(word));
  }

  // ── Admin moderation ──────────────────────────────────────────

  async getAllReviews(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedReviews> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const match: Record<string, any> = {};
    if (params.status) match.status = params.status;
    if (params.search) match.text = containsRegex(params.search);

    const lookups: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'reviewerId',
          foreignField: '_id',
          as: 'reviewer',
        },
      },
      { $unwind: { path: '$reviewer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'product_listings',
          localField: 'productListingId',
          foreignField: '_id',
          as: 'listing',
        },
      },
      { $unwind: { path: '$listing', preserveNullAndEmptyArrays: true } },
    ];

    const dataPipeline: PipelineStage[] = [
      ...lookups,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          rating: 1,
          text: 1,
          images: 1,
          status: 1,
          moderationNote: 1,
          moderatedAt: 1,
          createdAt: 1,
          'reviewer._id': 1,
          'reviewer.email': 1,
          'reviewer.profile': 1,
          'seller._id': 1,
          'seller.email': 1,
          'seller.profile': 1,
          'seller.averageRating': 1,
          'seller.reviewCount': 1,
          'listing._id': 1,
          'listing.title': 1,
        },
      },
    ];

    const [countResult, data] = await Promise.all([
      this.reviewModel.aggregate([...lookups, { $count: 'total' }]).exec(),
      this.reviewModel.aggregate(dataPipeline).exec(),
    ]);

    return {
      data,
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    };
  }

  async getReviewById(id: string): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    const review = await this.reviewModel
      .findById(id)
      .populate('reviewerId', 'email profile')
      .populate('sellerId', 'email profile averageRating reviewCount')
      .populate('productListingId', 'title')
      .lean()
      .exec();
    if (!review) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return review as unknown as ReviewDocument;
  }

  /**
   * Approve a pending review: it goes live, the seller's rating is recomputed,
   * and the reviewer is notified. Notifications/email are best-effort — a
   * delivery failure must not fail the admin action.
   */
  async approveReview(
    reviewId: string,
    adminId: string,
  ): Promise<ReviewDocument> {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    if (review.status === ReviewStatus.APPROVED) {
      return review; // already live — no-op
    }

    review.status = ReviewStatus.APPROVED;
    review.moderatedBy = new Types.ObjectId(adminId);
    review.moderatedAt = new Date();
    await review.save();

    await this.refreshSellerRating(review.sellerId.toString());
    this.notifyReviewer(review, 'approved').catch((err) =>
      this.logger.warn(
        `Failed to notify review approval ${reviewId}: ${(err as Error).message}`,
      ),
    );

    return review;
  }

  /**
   * Reject a review: it is deleted outright (with its uploaded images), the
   * seller's rating is recomputed in case it had been live, and the reviewer is
   * notified with the optional reason.
   */
  async rejectReview(
    reviewId: string,
    _adminId: string,
    reason?: string,
  ): Promise<{ deleted: boolean }> {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }

    const sellerId = review.sellerId.toString();
    const images = review.images ?? [];

    // Notify before deletion so we still have the context (reviewer, seller).
    this.notifyReviewer(review, 'rejected', reason).catch((err) =>
      this.logger.warn(
        `Failed to notify review rejection ${reviewId}: ${(err as Error).message}`,
      ),
    );

    await this.reviewModel.deleteOne({ _id: review._id }).exec();
    await this.cleanupImages(images);

    // A rejected review that was somehow already live would have counted toward
    // the rating; recompute so it drops off.
    await this.refreshSellerRating(sellerId);

    return { deleted: true };
  }

  /** Notify a reviewer of the moderation outcome (in-app + push + email). */
  private async notifyReviewer(
    review: ReviewDocument,
    outcome: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    const reviewerId = review.reviewerId.toString();
    const [reviewer, seller] = await Promise.all([
      this.userModel.findById(reviewerId).select('email').lean().exec(),
      this.userModel
        .findById(review.sellerId)
        .select('profile.firstName profile.lastName')
        .lean()
        .exec(),
    ]);

    const sellerName =
      [(seller as any)?.profile?.firstName, (seller as any)?.profile?.lastName]
        .filter(Boolean)
        .join(' ') || 'the seller';

    if (outcome === 'approved') {
      await this.notificationsService.sendReviewApprovedNotification(
        reviewerId,
        sellerName,
      );
      if (reviewer?.email) {
        await this.emailService.sendReviewApprovedEmail(
          reviewer.email,
          sellerName,
        );
      }
    } else {
      await this.notificationsService.sendReviewRejectedNotification(
        reviewerId,
        sellerName,
        reason,
      );
      if (reviewer?.email) {
        await this.emailService.sendReviewRejectedEmail(
          reviewer.email,
          sellerName,
          reason,
        );
      }
    }
  }
}
