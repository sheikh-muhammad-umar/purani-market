import { Module } from '@nestjs/common';
import { LocationService } from './location.service.js';
import { LocationController } from './location.controller.js';
import { ListingsModule } from '../listings/listings.module.js';

@Module({
  imports: [ListingsModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
