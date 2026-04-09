import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocationService } from './location.service.js';
import { LocationController } from './location.controller.js';
import { ListingsModule } from '../listings/listings.module.js';
import { Province, ProvinceSchema } from './schemas/province.schema.js';
import { City, CitySchema } from './schemas/city.schema.js';
import { Area, AreaSchema } from './schemas/area.schema.js';

@Module({
  imports: [
    ListingsModule,
    MongooseModule.forFeature([
      { name: Province.name, schema: ProvinceSchema },
      { name: City.name, schema: CitySchema },
      { name: Area.name, schema: AreaSchema },
    ]),
  ],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
