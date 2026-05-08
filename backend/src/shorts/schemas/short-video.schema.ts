import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DEFAULT_CURRENCY } from '../../common/constants/index.js';

export type ShortVideoDocument = HydratedDocument<ShortVideo>;

export enum ShortVideoStatus {
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

@Schema({ _id: false })
export class ShortVideoMedia {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: String })
  compressedUrl?: string;

  @Prop({ type: Number })
  duration?: number; // in seconds, max 60

  @Prop({ type: Number })
  originalSize?: number; // bytes

  @Prop({ type: Number })
  compressedSize?: number; // bytes

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;
}

@Schema({ _id: false })
export class ShortVideoLocation {
  @Prop({ type: Types.ObjectId, ref: 'Province' })
  provinceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'City' })
  cityId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Area' })
  areaId?: Types.ObjectId;

  @Prop({ type: String })
  province?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  area?: string;
}

@Schema({
  timestamps: true,
  collection: 'short_videos',
  toJSON: {
    transform: (_doc: any, ret: any) => {
      delete ret.__v;
      delete ret.deletedAt;
      return ret;
    },
  },
})
export class ShortVideo {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: String, maxlength: 100 })
  title?: string;

  @Prop({ type: String, maxlength: 500 })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId?: Types.ObjectId;

  @Prop({ type: String })
  categoryName?: string;

  @Prop({ type: Number, min: 0 })
  price?: number;

  @Prop({ type: String, default: DEFAULT_CURRENCY })
  currency?: string;

  @Prop({ type: ShortVideoLocation })
  location?: ShortVideoLocation;

  @Prop({ type: ShortVideoMedia, required: true })
  video!: ShortVideoMedia;

  @Prop({
    type: String,
    enum: ShortVideoStatus,
    default: ShortVideoStatus.PENDING_REVIEW,
    index: true,
  })
  status!: ShortVideoStatus;

  @Prop({ type: String })
  rejectionReason?: string;

  @Prop({ type: Number, default: 0 })
  rejectionCount!: number;

  @Prop({ type: Number, default: 0 })
  viewCount!: number;

  @Prop({ type: Number, default: 0 })
  favoriteCount!: number;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'ShortsPackagePurchase' })
  purchaseId?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isPaid!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing' })
  linkedListingId?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShortVideoSchema = SchemaFactory.createForClass(ShortVideo);

// Indexes
ShortVideoSchema.index({ sellerId: 1, status: 1 });
ShortVideoSchema.index({ status: 1, createdAt: -1 });
ShortVideoSchema.index({ expiresAt: 1 }, { sparse: true });
ShortVideoSchema.index({ sellerId: 1, createdAt: -1 });
ShortVideoSchema.index({ status: 1, viewCount: -1 });
ShortVideoSchema.index({ categoryId: 1, status: 1 });
ShortVideoSchema.index({ 'location.cityId': 1, status: 1 });
ShortVideoSchema.index({ title: 'text', description: 'text' });
