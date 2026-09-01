import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EntitlementGrant, EntitlementKind } from '../entitlement.types.js';

export type AdPackageDocument = HydratedDocument<AdPackage>;

export enum AdPackageType {
  FEATURED_ADS = 'featured_ads',
  AD_SLOTS = 'ad_slots',
  /**
   * Grants more than one kind of entitlement at once. Its contents live in
   * `entitlements`, so unlike the single-purpose types the name does not tell you
   * what the buyer gets.
   */
  BUNDLE = 'bundle',
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

  @Prop({ type: Number, required: true, min: 1 })
  duration!: number;

  /**
   * Total units across every entitlement.
   *
   * For a single-purpose package this is the entitlement's own quantity, which is
   * what it has always meant. For a bundle it is only a headline figure — spending
   * is tracked per entitlement, so nothing consumes this.
   */
  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  /**
   * What this package grants, one row per kind.
   *
   * Empty on every package created before bundles existed; those are read through
   * `packageEntitlements()`, which derives the equivalent row from `type` and
   * `quantity`. That is why no back-fill was needed.
   */
  @Prop({
    type: [
      {
        kind: { type: String, enum: EntitlementKind, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    default: [],
  })
  entitlements!: EntitlementGrant[];

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
