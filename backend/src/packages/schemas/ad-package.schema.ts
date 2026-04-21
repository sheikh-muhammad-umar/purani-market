import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdPackageDocument = HydratedDocument<AdPackage>;

export enum AdPackageType {
  FEATURED_ADS = 'featured_ads',
  AD_SLOTS = 'ad_slots',
}

@Schema({ timestamps: true, collection: 'ad_packages' })
export class CategoryPricing {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  price!: number;
}

@Schema({ timestamps: true, collection: 'ad_packages' })
export class AdPackage {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, enum: AdPackageType, required: true })
  type!: AdPackageType;

  @Prop({ type: Number, required: true, enum: [7, 15, 30] })
  duration!: number;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  defaultPrice!: number;

  @Prop({
    type: [
      { categoryId: { type: Types.ObjectId, ref: 'Category' }, price: Number },
    ],
    default: [],
  })
  categoryPricing!: CategoryPricing[];

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AdPackageSchema = SchemaFactory.createForClass(AdPackage);

// Indexes
AdPackageSchema.index({ type: 1, duration: 1 });
AdPackageSchema.index({ isActive: 1 });
