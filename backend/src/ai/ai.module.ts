import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  UserActivity,
  UserActivitySchema,
} from './schemas/user-activity.schema.js';
import { RecommendationService } from './recommendation.service.js';
import { ChatbotService } from './chatbot.service.js';
import { AdminTrackerService } from './admin-tracker.service.js';
import { AiController } from './ai.controller.js';
import { ListingsModule } from '../listings/listings.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
    ScheduleModule.forRoot(),
    ListingsModule,
  ],
  controllers: [AiController],
  providers: [RecommendationService, ChatbotService, AdminTrackerService],
  exports: [RecommendationService, ChatbotService, AdminTrackerService],
})
export class AiModule {}
