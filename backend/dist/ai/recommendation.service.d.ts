import { Model } from 'mongoose';
import { UserActivityDocument, UserAction } from './schemas/user-activity.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
export declare class RecommendationService {
    private readonly activityModel;
    private readonly listingModel;
    private readonly logger;
    constructor(activityModel: Model<UserActivityDocument>, listingModel: Model<ProductListingDocument>);
    trackActivity(userId: string, action: UserAction, data: {
        productListingId?: string;
        searchQuery?: string;
        categoryId?: string;
        metadata?: Record<string, any>;
    }): Promise<UserActivityDocument>;
    getRecommendations(userId: string, lat?: number, lng?: number, limit?: number): Promise<ProductListingDocument[]>;
    private getPersonalizedRecommendations;
    private getColdStartRecommendations;
    dismissRecommendation(userId: string, productListingId: string): Promise<void>;
    updateRecommendationModels(): Promise<void>;
}
