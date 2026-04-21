import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service.js';
import { FcmProvider } from './providers/fcm.provider.js';
import { HmsProvider } from './providers/hms.provider.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Favorite,
  FavoriteSchema,
} from '../favorites/schemas/favorite.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
  ],
  providers: [NotificationsService, FcmProvider, HmsProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
