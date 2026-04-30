import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ProductListing,
  ProductListingSchema,
} from '../listings/schemas/product-listing.schema.js';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { SeoController } from './seo.controller.js';
import { SitemapController } from './sitemap.controller.js';
import { RobotsController } from './robots.controller.js';
import { SeoService } from './seo.service.js';
import { SitemapService } from './sitemap.service.js';
import { SlugService } from './slug.service.js';
import { PrerenderService } from './prerender.service.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: Category.name, schema: CategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SeoController, SitemapController, RobotsController],
  providers: [SeoService, SitemapService, SlugService, PrerenderService],
  exports: [SeoService, SlugService, PrerenderService],
})
export class SeoModule {}
