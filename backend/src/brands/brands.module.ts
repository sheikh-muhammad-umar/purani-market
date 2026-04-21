import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from './schemas/brand.schema.js';
import {
  VehicleBrand,
  VehicleBrandSchema,
} from './schemas/vehicle-brand.schema.js';
import {
  VehicleModel,
  VehicleModelSchema,
} from './schemas/vehicle-model.schema.js';
import {
  VehicleVariant,
  VehicleVariantSchema,
} from './schemas/vehicle-variant.schema.js';
import { BrandsService } from './brands.service.js';
import { VehicleBrandService } from './vehicle-brand.service.js';
import { VehicleModelService } from './vehicle-model.service.js';
import { VehicleVariantService } from './vehicle-variant.service.js';
import { BrandsController } from './brands.controller.js';
import { VehicleBrandController } from './vehicle-brand.controller.js';
import { VehicleModelController } from './vehicle-model.controller.js';
import { VehicleVariantController } from './vehicle-variant.controller.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Brand.name, schema: BrandSchema },
      { name: VehicleBrand.name, schema: VehicleBrandSchema },
      { name: VehicleModel.name, schema: VehicleModelSchema },
      { name: VehicleVariant.name, schema: VehicleVariantSchema },
    ]),
    forwardRef(() => AiModule),
  ],
  controllers: [
    BrandsController,
    VehicleBrandController,
    VehicleModelController,
    VehicleVariantController,
  ],
  providers: [
    BrandsService,
    VehicleBrandService,
    VehicleModelService,
    VehicleVariantService,
  ],
  exports: [
    BrandsService,
    VehicleBrandService,
    VehicleModelService,
    VehicleVariantService,
  ],
})
export class BrandsModule {}
