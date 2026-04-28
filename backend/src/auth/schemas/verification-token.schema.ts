import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VerificationType } from '../../common/enums/verification-type.enum.js';

export { VerificationType } from '../../common/enums/verification-type.enum.js';

export type VerificationTokenDocument = HydratedDocument<VerificationToken>;

@Schema({ timestamps: true, collection: 'verification_tokens' })
export class VerificationToken {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: VerificationType, required: true })
  type!: VerificationType;

  @Prop({ type: String, required: true, index: true })
  token!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Boolean, default: false })
  used!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VerificationTokenSchema =
  SchemaFactory.createForClass(VerificationToken);

VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
