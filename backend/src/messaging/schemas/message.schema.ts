import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VOICE = 'voice',
  LOCATION = 'location',
}

export class LocationPayload {
  @Prop({ type: Number, required: true })
  latitude!: number;

  @Prop({ type: Number, required: true })
  longitude!: number;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: Boolean, default: false })
  isLive!: boolean;

  @Prop({ type: Date })
  expiresAt?: Date;
}

export class MediaPayload {
  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String })
  thumbnailUrl?: string;

  @Prop({ type: Number })
  duration?: number; // seconds, for voice notes

  @Prop({ type: String })
  mimeType?: string;

  @Prop({ type: Number })
  fileSize?: number;
}

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'messages',
})
export class Message {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type!: MessageType;

  @Prop({ type: String, default: '' })
  content!: string;

  @Prop({ type: Object })
  media?: MediaPayload;

  @Prop({ type: Object })
  location?: LocationPayload;

  @Prop({ type: Boolean, default: false })
  isRead!: boolean;

  createdAt!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
