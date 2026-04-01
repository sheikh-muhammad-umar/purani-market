import { Model } from 'mongoose';
import { ReviewDocument } from './schemas/review.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
export declare class ReviewsService {
    private readonly reviewModel;
    private readonly listingModel;
    private readonly conversationModel;
    constructor(reviewModel: Model<ReviewDocument>, listingModel: Model<ProductListingDocument>, conversationModel: Model<any>);
    createReview(reviewerId: string, dto: CreateReviewDto): Promise<ReviewDocument>;
    getReviewsByListing(listingId: string): Promise<ReviewDocument[]>;
    getReviewsBySeller(sellerId: string): Promise<{
        reviews: ReviewDocument[];
        averageRating: number;
        totalReviews: number;
    }>;
    calculateAverageRating(sellerId: string): Promise<number>;
    containsProhibitedContent(text: string): boolean;
}
