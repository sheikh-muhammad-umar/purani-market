import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductListing,
  ProductListingSchema,
} from '../listings/schemas/product-listing.schema.js';
import {
  ShortVideo,
  ShortVideoSchema,
} from '../shorts/schemas/short-video.schema.js';
import {
  Conversation,
  ConversationSchema,
} from '../messaging/schemas/conversation.schema.js';
import {
  UserActivity,
  UserActivitySchema,
} from '../ai/schemas/user-activity.schema.js';
import { EngagementService } from './engagement.service.js';
import { EngagementController } from './engagement.controller.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Seller-facing engagement reporting.
 *
 * Its own module rather than a method on listings or shorts, because the figures
 * are stitched together from four collections that belong to four other modules.
 * Putting it in either one would have meant that module reaching across the app,
 * and the same aggregation being written twice — once per item type.
 *
 * Read-only: it registers the models it reads but owns none of them.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: ShortVideo.name, schema: ShortVideoSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
    AuthModule,
  ],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
