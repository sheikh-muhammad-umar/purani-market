import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service.js';
import { BroadcastService } from './broadcast.service.js';
import {
  UserNotificationsController,
  AdminNotificationsController,
} from './notifications.controller.js';
import { FcmProvider } from './providers/fcm.provider.js';
import { HmsProvider } from './providers/hms.provider.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Favorite,
  FavoriteSchema,
} from '../favorites/schemas/favorite.schema.js';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema.js';
import {
  UserNotification,
  UserNotificationSchema,
} from './schemas/user-notification.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => AiModule),
  ],
  controllers: [UserNotificationsController, AdminNotificationsController],
  providers: [NotificationsService, BroadcastService, FcmProvider, HmsProvider],
  exports: [NotificationsService, BroadcastService],
})
export class NotificationsModule {}
