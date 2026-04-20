import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AdPackage, AdPackageSchema } from './schemas/ad-package.schema.js';
import {
  PackagePurchase,
  PackagePurchaseSchema,
} from './schemas/package-purchase.schema.js';
import { PackagesService } from './packages.service.js';
import { PackagesController } from './packages.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { UsersModule } from '../users/users.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: AdPackage.name, schema: AdPackageSchema },
      { name: PackagePurchase.name, schema: PackagePurchaseSchema },
    ]),
    PaymentsModule,
    UsersModule,
    forwardRef(() => ListingsModule),
    forwardRef(() => AiModule),
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
