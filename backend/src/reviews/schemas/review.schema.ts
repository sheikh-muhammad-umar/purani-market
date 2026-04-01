import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing', required: true })
  productListingId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ type: String, maxlength: 2000, default: '' })
  text!: string;

  @Prop({ type: String, enum: ReviewStatus, default: ReviewStatus.APPROVED })
  status!: ReviewStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ sellerId: 1 });
ReviewSchema.index({ productListingId: 1 });
ReviewSchema.index({ reviewerId: 1, productListingId: 1 }, { unique: true });
