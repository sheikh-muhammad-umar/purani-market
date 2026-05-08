import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShortLikeDocument = HydratedDocument<ShortLike>;

@Schema({ timestamps: true, collection: 'short_likes' })
export class ShortLike {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ShortVideo', required: true })
  shortId!: Types.ObjectId;

  createdAt!: Date;
}

export const ShortLikeSchema = SchemaFactory.createForClass(ShortLike);

ShortLikeSchema.index({ userId: 1, shortId: 1 }, { unique: true });
ShortLikeSchema.index({ shortId: 1 });
