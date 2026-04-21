import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
} from './schemas/review.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { CreateReviewDto } from './dto/create-review.dto.js';

const PROHIBITED_WORDS = [
  'spam',
  'scam',
  'fake',
  'fraud',
  'illegal',
  'hate',
  'violence',
  'abuse',
];

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel('Conversation')
    private readonly conversationModel: Model<any>,
  ) {}

  async createReview(
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDocument> {
    const { productListingId, rating, text } = dto;

    if (!Types.ObjectId.isValid(productListingId)) {
      throw new NotFoundException('Listing not found');
    }

    const listing = await this.listingModel.findById(productListingId).exec();
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId.toString() === reviewerId) {
      throw new ForbiddenException('You cannot review your own listing');
    }

    // Check if buyer has had a conversation with the seller about this listing
    const conversation = await this.conversationModel
      .findOne({
        buyerId: new Types.ObjectId(reviewerId),
        sellerId: listing.sellerId,
        productListingId: new Types.ObjectId(productListingId),
      })
      .exec();

    if (!conversation) {
      throw new BadRequestException(
        'You must have a conversation with the seller about this listing before submitting a review',
      );
    }

    // Check for prohibited content
    const status = this.containsProhibitedContent(text || '')
      ? ReviewStatus.PENDING
      : ReviewStatus.APPROVED;

    try {
      const review = new this.reviewModel({
        reviewerId: new Types.ObjectId(reviewerId),
        sellerId: listing.sellerId,
        productListingId: new Types.ObjectId(productListingId),
        rating,
        text: text || '',
        status,
      });
      return await review.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('You have already reviewed this listing');
      }
      throw error;
    }
  }

  async getReviewsByListing(listingId: string): Promise<ReviewDocument[]> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException('Listing not found');
    }

    return this.reviewModel
      .find({
        productListingId: new Types.ObjectId(listingId),
        status: ReviewStatus.APPROVED,
      })
      .populate(
        'reviewerId',
        'profile.firstName profile.lastName profile.avatar',
      )
      .sort({ createdAt: -1 })
      .exec();
  }

  async getReviewsBySeller(sellerId: string): Promise<{
    reviews: ReviewDocument[];
    averageRating: number;
    totalReviews: number;
  }> {
    if (!Types.ObjectId.isValid(sellerId)) {
      throw new NotFoundException('Seller not found');
    }

    const reviews = await this.reviewModel
      .find({
        sellerId: new Types.ObjectId(sellerId),
        status: ReviewStatus.APPROVED,
      })
      .populate(
        'reviewerId',
        'profile.firstName profile.lastName profile.avatar',
      )
      .populate('productListingId', 'title')
      .sort({ createdAt: -1 })
      .exec();

    const averageRating = await this.calculateAverageRating(sellerId);

    return {
      reviews,
      averageRating,
      totalReviews: reviews.length,
    };
  }

  async calculateAverageRating(sellerId: string): Promise<number> {
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
          },
        },
      ])
      .exec();

    if (!result.length) {
      return 0;
    }

    return Math.round(result[0].averageRating * 10) / 10;
  }

  containsProhibitedContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    return PROHIBITED_WORDS.some((word) => lowerText.includes(word));
  }
}
