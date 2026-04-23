import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IdVerificationDocument = HydratedDocument<IdVerification>;

export enum IdVerificationStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ _id: false })
export class CnicImage {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String, required: true })
  key!: string;
}

@Schema({
  timestamps: true,
  collection: 'id_verifications',
  toJSON: {
    transform: (_doc: any, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class IdVerification {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: CnicImage, required: true })
  cnicFront!: CnicImage;

  @Prop({ type: CnicImage, required: true })
  cnicBack!: CnicImage;

  @Prop({ type: CnicImage, required: true })
  selfieFront!: CnicImage;

  @Prop({ type: CnicImage, required: true })
  selfieBack!: CnicImage;

  @Prop({
    type: String,
    enum: IdVerificationStatus,
    default: IdVerificationStatus.PENDING,
  })
  status!: IdVerificationStatus;

  @Prop({ type: String })
  rejectionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const IdVerificationSchema =
  SchemaFactory.createForClass(IdVerification);

IdVerificationSchema.index({ userId: 1, status: 1 });
IdVerificationSchema.index({ status: 1, createdAt: -1 });
