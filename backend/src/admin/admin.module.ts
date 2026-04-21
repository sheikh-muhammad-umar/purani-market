import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { AiModule } from '../ai/ai.module.js';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema.js';
import {
  PackagePurchase,
  PackagePurchaseSchema,
} from '../packages/schemas/package-purchase.schema.js';
import {
  UserActivity,
  UserActivitySchema,
} from '../ai/schemas/user-activity.schema.js';
import {
  RejectionReason,
  RejectionReasonSchema,
} from './schemas/rejection-reason.schema.js';
import {
  DeletionReason,
  DeletionReasonSchema,
} from './schemas/deletion-reason.schema.js';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ListingsModule,
    MessagingModule,
    NotificationsModule,
    CategoriesModule,
    forwardRef(() => AiModule),
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: PackagePurchase.name, schema: PackagePurchaseSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
      { name: RejectionReason.name, schema: RejectionReasonSchema },
      { name: DeletionReason.name, schema: DeletionReasonSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
