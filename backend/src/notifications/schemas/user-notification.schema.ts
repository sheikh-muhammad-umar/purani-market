import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DEFAULT_NOTIFICATION_CATEGORY } from '../../common/constants/notification.constants.js';

export type UserNotificationDocument = HydratedDocument<UserNotification>;

@Schema({ timestamps: true, collection: 'user_notifications' })
export class UserNotification {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Notification' })
  notificationId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, default: DEFAULT_NOTIFICATION_CATEGORY })
  category!: string;

  @Prop({ type: String })
  channel?: string;

  @Prop({ type: Boolean, default: false })
  read!: boolean;

  @Prop({ type: Object })
  data?: Record<string, any>;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserNotificationSchema =
  SchemaFactory.createForClass(UserNotification);

UserNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
UserNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
); // TTL: 30 days
