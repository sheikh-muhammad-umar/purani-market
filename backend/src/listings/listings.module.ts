import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductListing,
  ProductListingSchema,
} from './schemas/product-listing.schema.js';
import { ListingsService } from './listings.service.js';
import { ListingsController } from './listings.controller.js';
import { MediaService } from './media.service.js';
import { StorageService } from './storage.service.js';
import { UsersModule } from '../users/users.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { PackagesModule } from '../packages/packages.module.js';
import { SearchModule } from '../search/search.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductListing.name, schema: ProductListingSchema },
    ]),
    UsersModule,
    CategoriesModule,
    forwardRef(() => PackagesModule),
    SearchModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService, MediaService, StorageService],
  exports: [ListingsService, MediaService, MongooseModule],
})
export class ListingsModule {}
