import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdPackageType } from './ad-package.schema.js';

export type PackagePurchaseDocument = HydratedDocument<PackagePurchase>;

export enum PaymentMethod {
  JAZZCASH = 'jazzcash',
  EASYPAISA = 'easypaisa',
  CARD = 'card',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** Discriminator for the unified package_purchases collection */
export enum PurchaseType {
  ADS = 'ads',
  SHORTS = 'shorts',
}

@Schema({ timestamps: true, collection: 'package_purchases' })
export class PackagePurchase {
  _id!: Types.ObjectId;

  /** Discriminator: 'ads' or 'shorts' */
  @Prop({ type: String, enum: PurchaseType, required: true })
  purchaseType!: PurchaseType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  packageId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: -1 })
  remainingQuantity!: number;

  @Prop({ type: Number, required: true, min: 1 })
  duration!: number;

  @Prop({ type: Number, required: true, min: 0 })
  price!: number;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @Prop({ type: String, default: null })
  paymentTransactionId?: string;

  @Prop({ type: Date, default: null })
  activatedAt?: Date;

  @Prop({ type: Date, default: null })
  expiresAt?: Date;

  /** Currency code for the payment (e.g. PKR, USD). */
  @Prop({ type: String })
  currency?: string;

  // ─── Ads-specific fields ───────────────────────────────────

  /** Ad package type (featured_ads / ad_slots). Only for purchaseType='ads'. */
  @Prop({ type: String, enum: AdPackageType })
  type?: AdPackageType;

  /** Category the ad package applies to. Only for purchaseType='ads'. */
  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  categoryId?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PackagePurchaseSchema =
  SchemaFactory.createForClass(PackagePurchase);

// Indexes
PackagePurchaseSchema.index({ purchaseType: 1, sellerId: 1 });
PackagePurchaseSchema.index({ paymentStatus: 1 });
PackagePurchaseSchema.index({ expiresAt: 1 });
PackagePurchaseSchema.index({
  purchaseType: 1,
  sellerId: 1,
  categoryId: 1,
  paymentStatus: 1,
  remainingQuantity: 1,
  expiresAt: 1,
});
PackagePurchaseSchema.index({
  purchaseType: 1,
  sellerId: 1,
  paymentStatus: 1,
  remainingQuantity: 1,
  expiresAt: 1,
});
