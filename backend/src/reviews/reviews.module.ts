import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Review, ReviewSchema } from './schemas/review.schema.js';
import { ReviewsService } from './reviews.service.js';
import { ReviewsCleanupService } from './reviews-cleanup.service.js';
import { ReviewsController } from './reviews.controller.js';
import { ListingsModule } from '../listings/listings.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    ListingsModule,
    MessagingModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsCleanupService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
