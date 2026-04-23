import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema.js';
import {
  ProductListing,
  ProductListingDocument,
} from '../listings/schemas/product-listing.schema.js';
import { ERROR } from '../common/constants/error-messages.js';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
  ) {}

  async addFavorite(
    userId: string,
    productListingId: string,
  ): Promise<FavoriteDocument> {
    if (!Types.ObjectId.isValid(productListingId)) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    const listing = await this.listingModel.findById(productListingId).exec();
    if (!listing) {
      throw new NotFoundException(ERROR.LISTING_NOT_FOUND);
    }

    try {
      const favorite = new this.favoriteModel({
        userId: new Types.ObjectId(userId),
        productListingId: new Types.ObjectId(productListingId),
      });
      const saved = await favorite.save();

      // Increment favoriteCount on the listing
      await this.listingModel
        .updateOne(
          { _id: new Types.ObjectId(productListingId) },
          { $inc: { favoriteCount: 1 } },
        )
        .exec();

      return saved;
    } catch (error: any) {
      // Handle duplicate key error (unique compound index)
      if (error.code === 11000) {
        throw new ConflictException('Listing is already in your favorites');
      }
      throw error;
    }
  }

  async getUserFavorites(userId: string): Promise<FavoriteDocument[]> {
    return this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'productListingId',
        select:
          'title price status images condition location createdAt isFeatured',
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async removeFavorite(favoriteId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(favoriteId)) {
      throw new NotFoundException(ERROR.FAVORITE_NOT_FOUND);
    }

    const favorite = await this.favoriteModel.findById(favoriteId).exec();
    if (!favorite) {
      throw new NotFoundException(ERROR.FAVORITE_NOT_FOUND);
    }

    if (favorite.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You are not authorized to remove this favorite',
      );
    }

    await this.favoriteModel.deleteOne({ _id: favorite._id }).exec();

    // Decrement favoriteCount on the listing
    await this.listingModel
      .updateOne(
        { _id: favorite.productListingId },
        { $inc: { favoriteCount: -1 } },
      )
      .exec();
  }
}
