import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    createReview(userId: string, dto: CreateReviewDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/review.schema.js").Review, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/review.schema.js").Review & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    getReviewsByListing(listingId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/review.schema.js").Review, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/review.schema.js").Review & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getReviewsBySeller(sellerId: string): Promise<{
        reviews: import("./schemas/review.schema.js").ReviewDocument[];
        averageRating: number;
        totalReviews: number;
    }>;
}
