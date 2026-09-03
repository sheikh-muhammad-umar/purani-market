import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ShortVideo, ShortVideoSchema } from './schemas/short-video.schema.js';
import {
  ShortsPackage,
  ShortsPackageSchema,
} from './schemas/shorts-package.schema.js';
import {
  PackagePurchase,
  PackagePurchaseSchema,
} from '../packages/schemas/package-purchase.schema.js';
import { ShortLike, ShortLikeSchema } from './schemas/short-like.schema.js';
import { ShortsService } from './shorts.service.js';
import { ShortsVideoService } from './shorts-video.service.js';
import { ShortsController } from './shorts.controller.js';
import { ListingsModule } from '../listings/listings.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AiModule } from '../ai/ai.module.js';
import { PackagesModule } from '../packages/packages.module.js';
import { ViewCounterModule } from '../views/view-counter.module.js';
import { SearchModule } from '../search/search.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: ShortVideo.name, schema: ShortVideoSchema },
      { name: ShortsPackage.name, schema: ShortsPackageSchema },
      { name: PackagePurchase.name, schema: PackagePurchaseSchema },
      { name: ShortLike.name, schema: ShortLikeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => ListingsModule),
    UsersModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => AiModule),
    // For the shared entitlement filter, so "what can I spend on a short" is not
    // a second, drifting copy of the same query.
    forwardRef(() => PackagesModule),
    ViewCounterModule,
    forwardRef(() => SearchModule),
  ],
  controllers: [ShortsController],
  providers: [ShortsService, ShortsVideoService],
  exports: [ShortsService],
})
export class ShortsModule {}
