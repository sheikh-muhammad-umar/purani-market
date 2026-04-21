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

@Schema({ timestamps: true, collection: 'package_purchases' })
export class PackagePurchase {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AdPackage', required: true })
  packageId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  categoryId?: Types.ObjectId;

  @Prop({ type: String, enum: AdPackageType, required: true })
  type!: AdPackageType;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  remainingQuantity!: number;

  @Prop({ type: Number, required: true, enum: [7, 15, 30] })
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

  createdAt!: Date;
  updatedAt!: Date;
}

export const PackagePurchaseSchema =
  SchemaFactory.createForClass(PackagePurchase);

// Indexes
PackagePurchaseSchema.index({ sellerId: 1 });
PackagePurchaseSchema.index({ paymentStatus: 1 });
PackagePurchaseSchema.index({ expiresAt: 1 });
