import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { IdVerificationController } from './id-verification.controller.js';
import { IdVerificationService } from './id-verification.service.js';
import { IdVerificationCleanupService } from './id-verification-cleanup.service.js';
import {
  IdVerification,
  IdVerificationSchema,
} from './schemas/id-verification.schema.js';
import { UsersModule } from '../users/users.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: IdVerification.name, schema: IdVerificationSchema },
    ]),
    UsersModule,
    ListingsModule, // for StorageService
    forwardRef(() => AiModule), // for AdminTrackerService
  ],
  controllers: [IdVerificationController],
  providers: [IdVerificationService, IdVerificationCleanupService],
  exports: [IdVerificationService],
})
export class IdVerificationModule {}
