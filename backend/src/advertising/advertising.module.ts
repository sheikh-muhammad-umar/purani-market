import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CategoriesModule } from '../categories/categories.module.js';
import { AiModule } from '../ai/ai.module.js';
import { AdvertisingService } from './advertising.service.js';
import { AdvertisingController } from './advertising.controller.js';
import { AdvertisingAdminController } from './advertising-admin.controller.js';
import { Advertiser, AdvertiserSchema } from './schemas/advertiser.schema.js';
import { AdCampaign, AdCampaignSchema } from './schemas/ad-campaign.schema.js';
import { AdCreative, AdCreativeSchema } from './schemas/ad-creative.schema.js';
import { AdEvent, AdEventSchema } from './schemas/ad-event.schema.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Advertiser.name, schema: AdvertiserSchema },
      { name: AdCampaign.name, schema: AdCampaignSchema },
      { name: AdCreative.name, schema: AdCreativeSchema },
      { name: AdEvent.name, schema: AdEventSchema },
    ]),
    // Category targeting walks the category tree to honour parent targeting.
    CategoriesModule,
    // AdminTrackerService, for the audit trail on inventory changes.
    AiModule,
  ],
  controllers: [AdvertisingController, AdvertisingAdminController],
  providers: [AdvertisingService],
  exports: [AdvertisingService],
})
export class AdvertisingModule {}
