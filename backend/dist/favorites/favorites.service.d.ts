import { Model } from 'mongoose';
import { FavoriteDocument } from './schemas/favorite.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
export declare class FavoritesService {
    private readonly favoriteModel;
    private readonly listingModel;
    constructor(favoriteModel: Model<FavoriteDocument>, listingModel: Model<ProductListingDocument>);
    addFavorite(userId: string, productListingId: string): Promise<FavoriteDocument>;
    getUserFavorites(userId: string): Promise<FavoriteDocument[]>;
    removeFavorite(favoriteId: string, userId: string): Promise<void>;
}
