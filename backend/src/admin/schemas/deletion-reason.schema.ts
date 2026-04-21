import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeletionReasonDocument = HydratedDocument<DeletionReason>;

@Schema({ timestamps: true, collection: 'deletion_reasons' })
export class DeletionReason {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 200 })
  title!: string;

  @Prop({ type: String, maxlength: 500 })
  description?: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DeletionReasonSchema = SchemaFactory.createForClass(DeletionReason);
