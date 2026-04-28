import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationAudience,
  NotificationStatus,
} from '../../common/enums/notification.enum.js';
import { DEFAULT_NOTIFICATION_CATEGORY } from '../../common/constants/notification.constants.js';

export {
  NotificationChannel,
  NotificationAudience,
  NotificationStatus,
} from '../../common/enums/notification.enum.js';

export {
  DEFAULT_NOTIFICATION_CATEGORY,
  BROADCAST_DATA_TYPE,
} from '../../common/constants/notification.constants.js';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String })
  htmlBody?: string;

  @Prop({ type: String, enum: NotificationChannel, required: true })
  channel!: NotificationChannel;

  @Prop({ type: String, enum: NotificationAudience, required: true })
  audience!: NotificationAudience;

  @Prop({ type: String })
  targetRole?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  targetUserIds!: Types.ObjectId[];

  @Prop({ type: String, default: DEFAULT_NOTIFICATION_CATEGORY })
  category!: string;

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.DRAFT,
  })
  status!: NotificationStatus;

  @Prop({ type: Number, default: 0 })
  recipientCount!: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt!: Date;
  updatedAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ status: 1, createdAt: -1 });
NotificationSchema.index({ sentBy: 1 });
