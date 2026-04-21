import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'conversations',
})
export class Conversation {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductListing', required: true })
  productListingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ type: String })
  lastMessagePreview?: string;

  createdAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ buyerId: 1 });
ConversationSchema.index({ sellerId: 1 });
ConversationSchema.index({ productListingId: 1 });
ConversationSchema.index(
  { buyerId: 1, sellerId: 1, productListingId: 1 },
  { unique: true },
);
