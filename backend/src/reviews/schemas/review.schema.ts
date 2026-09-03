import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** A photo attached to a review. Mirrors the reports feature's ReportImage. */
@Schema({ _id: false })
export class ReviewImage {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String, required: true })
  key!: string;
}

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reviewerId!: Types.ObjectId;

  /** The user being reviewed. A review is about the seller, not a listing. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  /**
   * Optional context: the listing that prompted the review. Kept for reference
   * only — it is not what the review is keyed on, and a review can exist
   * without it (e.g. left from a general conversation with the seller).
   */
  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  productListingId?: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  /** The written review. Required — a rating must be justified with words. */
  @Prop({ type: String, required: true, minlength: 1, maxlength: 2000 })
  text!: string;

  /** Up to 2 optional photos attached by the reviewer. */
  @Prop({ type: [ReviewImage], default: [] })
  images!: ReviewImage[];

  @Prop({ type: String, enum: ReviewStatus, default: ReviewStatus.APPROVED })
  status!: ReviewStatus;

  /** Admin note recorded when moderating (e.g. reason for rejection). */
  @Prop({ type: String })
  moderationNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  moderatedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ sellerId: 1 });
ReviewSchema.index({ productListingId: 1 });
// One review per buyer per seller — a rating is about the seller, so a buyer
// leaves at most one, regardless of how many of the seller's listings they saw.
ReviewSchema.index({ reviewerId: 1, sellerId: 1 }, { unique: true });
// Admin moderation queue: filter by status, newest first.
ReviewSchema.index({ status: 1, createdAt: -1 });
