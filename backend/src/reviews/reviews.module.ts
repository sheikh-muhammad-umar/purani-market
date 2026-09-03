import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './schemas/review.schema.js';
import { ReviewsService } from './reviews.service.js';
import { ReviewsController } from './reviews.controller.js';
import { ListingsModule } from '../listings/listings.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { UsersModule } from '../users/users.module.js';
import { AiModule } from '../ai/ai.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    ListingsModule, // StorageService + ProductListing model
    MessagingModule, // Conversation model
    UsersModule, // User model (denormalized rating)
    AiModule, // AdminTrackerService for event tracking
    NotificationsModule, // reviewer notifications on moderation
    AuthModule, // EmailService for reviewer emails
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
