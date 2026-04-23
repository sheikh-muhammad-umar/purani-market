import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { DEFAULT_CURRENCY } from '../../common/constants/index.js';

export type ProductListingDocument = HydratedDocument<ProductListing>;

export enum ListingCondition {
  NEW = 'new',
  USED = 'used',
  REFURBISHED = 'refurbished',
}

export enum ListingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected',
  SOLD = 'sold',
  RESERVED = 'reserved',
  DELETED = 'deleted',
}

@Schema({ _id: false })
export class ListingPrice {
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, default: DEFAULT_CURRENCY })
  currency!: string;
}

@Schema({ _id: false })
export class ListingImage {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;
}

@Schema({ _id: false })
export class ListingVideo {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumbnailUrl?: string;
}

@Schema({ _id: false })
export class ListingLocation {
  @Prop({ type: Types.ObjectId, ref: 'Province' })
  provinceId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'City' })
  cityId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Area' })
  areaId?: Types.ObjectId;

  @Prop({ type: String })
  blockPhase?: string;

  // Denormalized names for display (populated on read, not used for filtering)
  @Prop({ type: String })
  province?: string;

  @Prop({ type: String })
  city?: string;

  @Prop({ type: String })
  area?: string;
}

@Schema({ _id: false })
export class ListingContactInfo {
  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  email?: string;
}

@Schema({
  timestamps: true,
  collection: 'product_listings',
  toJSON: {
    transform: (_doc: any, ret: any) => {
      delete ret.__v;
      delete ret.deletedAt;
      if (ret.location) {
        delete ret.location.provinceId;
        delete ret.location.cityId;
        delete ret.location.areaId;
      }
      return ret;
    },
  },
})
export class ProductListing {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 150 })
  title!: string;

  @Prop({ type: String, required: true, maxlength: 5000 })
  description!: string;

  @Prop({ type: ListingPrice, required: true })
  price!: ListingPrice;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], default: [] })
  categoryPath!: Types.ObjectId[];

  @Prop({ type: String, enum: ListingCondition, required: true })
  condition!: ListingCondition;

  @Prop({ type: Types.ObjectId, ref: 'Brand' })
  brandId?: Types.ObjectId;

  @Prop({ type: String })
  brandName?: string;

  @Prop({ type: Types.ObjectId, ref: 'VehicleBrand' })
  vehicleBrandId?: Types.ObjectId;

  @Prop({ type: String })
  vehicleBrandName?: string;

  @Prop({ type: Types.ObjectId, ref: 'VehicleModel' })
  modelId?: Types.ObjectId;

  @Prop({ type: String })
  modelName?: string;

  @Prop({ type: Types.ObjectId, ref: 'VehicleVariant' })
  variantId?: Types.ObjectId;

  @Prop({ type: String })
  variantName?: string;

  @Prop({
    type: MongooseSchema.Types.Map,
    of: MongooseSchema.Types.Mixed,
    default: () => new Map(),
  })
  categoryAttributes!: Map<string, any>;

  @Prop({ type: [String], default: [] })
  selectedFeatures!: string[];

  @Prop({
    type: [ListingImage],
    default: [],
    validate: {
      validator: (v: ListingImage[]) => v.length <= 20,
      message: 'A listing can have a maximum of 20 images',
    },
  })
  images!: ListingImage[];

  @Prop({ type: ListingVideo, default: undefined })
  video?: ListingVideo;

  @Prop({ type: ListingLocation })
  location?: ListingLocation;

  @Prop({ type: ListingContactInfo })
  contactInfo?: ListingContactInfo;

  @Prop({ type: String, enum: ListingStatus, default: ListingStatus.ACTIVE })
  status!: ListingStatus;

  @Prop({ type: Boolean, default: false })
  isFeatured!: boolean;

  @Prop({ type: Date })
  featuredUntil?: Date;

  @Prop({ type: String })
  rejectionReason?: string;

  @Prop({ type: [Types.ObjectId], ref: 'RejectionReason', default: [] })
  rejectionReasonIds?: Types.ObjectId[];

  @Prop({ type: String })
  rejectionNote?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: Number, default: 0 })
  rejectionCount!: number;

  @Prop({ type: Number, default: 0 })
  viewCount!: number;

  @Prop({ type: Number, default: 0 })
  favoriteCount!: number;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: String })
  deletionReason?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ProductListingSchema =
  SchemaFactory.createForClass(ProductListing);

// Indexes
ProductListingSchema.index({ sellerId: 1 });
ProductListingSchema.index({ categoryId: 1 });
ProductListingSchema.index({ status: 1 });
ProductListingSchema.index({ isFeatured: -1, createdAt: -1 });
ProductListingSchema.index({ createdAt: -1 });
ProductListingSchema.index({ categoryPath: 1 });
ProductListingSchema.index({ 'location.cityId': 1 });
ProductListingSchema.index({ 'location.provinceId': 1 });
ProductListingSchema.index({ 'location.cityId': 1, 'location.areaId': 1 });
ProductListingSchema.index({ brandId: 1 });
ProductListingSchema.index({ vehicleBrandId: 1 });
ProductListingSchema.index({ modelId: 1 });
ProductListingSchema.index({ vehicleBrandId: 1, modelId: 1 });
