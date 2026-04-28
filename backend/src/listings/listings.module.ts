import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  ProductListing,
  ProductListingSchema,
} from './schemas/product-listing.schema.js';
import { ListingsService } from './listings.service.js';
import { ListingLifecycleService } from './listing-lifecycle.service.js';
import { ListingsController } from './listings.controller.js';
import { MediaService } from './media.service.js';
import { StorageService } from './storage.service.js';
import { UsersModule } from '../users/users.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { PackagesModule } from '../packages/packages.module.js';
import { SearchModule } from '../search/search.module.js';
import { BrandsModule } from '../brands/brands.module.js';
import { AiModule } from '../ai/ai.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import {
  Conversation,
  ConversationSchema,
} from '../messaging/schemas/conversation.schema.js';
import { Message, MessageSchema } from '../messaging/schemas/message.schema.js';
import {
  PackagePurchase,
  PackagePurchaseSchema,
} from '../packages/schemas/package-purchase.schema.js';
import {
  Favorite,
  FavoriteSchema,
} from '../favorites/schemas/favorite.schema.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: PackagePurchase.name, schema: PackagePurchaseSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
    UsersModule,
    forwardRef(() => CategoriesModule),
    forwardRef(() => PackagesModule),
    forwardRef(() => AiModule),
    forwardRef(() => NotificationsModule),
    SearchModule,
    BrandsModule,
  ],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    ListingLifecycleService,
    MediaService,
    StorageService,
  ],
  exports: [ListingsService, MediaService, StorageService, MongooseModule],
})
export class ListingsModule {}
