import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AdPackageType } from './ad-package.schema.js';
import { EntitlementBalance, EntitlementKind } from '../entitlement.types.js';

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

  /**
   * Units left on a single-entitlement purchase, or `-1` once expiry has been
   * processed.
   *
   * Not consulted for a bundle: those track a balance per entitlement in
   * `entitlements`, and this holds the purchased total purely for display.
   */
  @Prop({ type: Number, required: true, min: -1 })
  remainingQuantity!: number;

  /**
   * Per-entitlement balances, snapshotted from the package at purchase time.
   *
   * Empty for purchases of single-purpose packages, which keep using
   * `quantity`/`remainingQuantity`; read both shapes through `purchaseBalances()`.
   *
   * Snapshotted rather than read live from the package so that editing a package
   * later cannot change what an existing buyer is owed — the bug that made ad-slot
   * expiry claw back the wrong number of slots.
   */
  @Prop({
    type: [
      {
        kind: { type: String, enum: EntitlementKind, required: true },
        quantity: { type: Number, required: true, min: 1 },
        remaining: { type: Number, required: true, min: 0 },
      },
    ],
    default: [],
  })
  entitlements!: EntitlementBalance[];

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

  /** When an admin refunded this purchase. */
  @Prop({ type: Date, default: null })
  refundedAt?: Date;

  /** Why it was refunded, shown to the seller and kept for the audit trail. */
  @Prop({ type: String, trim: true })
  refundReason?: string;

  /** Which admin issued it. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  refundedBy?: Types.ObjectId;

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
// Spending a bundle means finding "this seller's purchases that still hold kind X".
PackagePurchaseSchema.index({
  sellerId: 1,
  'entitlements.kind': 1,
  paymentStatus: 1,
  expiresAt: 1,
});
// handlePaymentCallback looks purchases up by transaction id on every callback.
PackagePurchaseSchema.index({ paymentTransactionId: 1 });
// featureListing filters on the legacy ads type; nothing covered it before.
PackagePurchaseSchema.index({
  purchaseType: 1,
  sellerId: 1,
  type: 1,
  paymentStatus: 1,
  expiresAt: 1,
});
