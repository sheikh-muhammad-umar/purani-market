import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'favorites',
})
export class Favorite {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing', required: true })
  productListingId!: Types.ObjectId;

  createdAt!: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Unique compound index to prevent duplicate favorites
FavoriteSchema.index({ userId: 1, productListingId: 1 }, { unique: true });

// Index for querying user's favorites
FavoriteSchema.index({ userId: 1 });
