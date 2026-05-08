import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentStatus } from '../../packages/schemas/package-purchase.schema.js';

export type ShortsPackagePurchaseDocument =
  HydratedDocument<ShortsPackagePurchase>;

export { PaymentStatus };

@Schema({ timestamps: true, collection: 'shorts_package_purchases' })
export class ShortsPackagePurchase {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'ShortsPackage',
    required: true,
  })
  packageId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantity!: number;

  @Prop({ type: Number, required: true })
  remainingQuantity!: number;

  @Prop({ type: Number, required: true })
  duration!: number; // days

  @Prop({ type: Number, required: true })
  maxVideoLength!: number; // seconds

  @Prop({ type: Number, required: true })
  amountPaid!: number;

  @Prop({ type: String })
  currency?: string;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Prop({ type: String })
  paymentMethod?: string;

  @Prop({ type: String })
  transactionId?: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ShortsPackagePurchaseSchema = SchemaFactory.createForClass(
  ShortsPackagePurchase,
);

ShortsPackagePurchaseSchema.index({ sellerId: 1, paymentStatus: 1 });
ShortsPackagePurchaseSchema.index({ expiresAt: 1 });
