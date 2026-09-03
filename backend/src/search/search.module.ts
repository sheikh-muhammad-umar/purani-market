import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CategoriesModule } from '../categories/categories.module.js';
import {
  ProductListing,
  ProductListingSchema,
} from '../listings/schemas/product-listing.schema.js';
import {
  ShortVideo,
  ShortVideoSchema,
} from '../shorts/schemas/short-video.schema.js';
import { SearchIndexService } from './search-index.service.js';
import { SearchSyncService } from './search-sync.service.js';
import { SearchService } from './search.service.js';
import { SearchReconciliationService } from './search-reconciliation.service.js';
import { SearchController } from './search.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: ShortVideo.name, schema: ShortVideoSchema },
    ]),
    ElasticsearchModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('elasticsearch.username');
        const password = configService.get<string>('elasticsearch.password');
        return {
          node:
            configService.get<string>('elasticsearch.node') ||
            'http://localhost:9200',
          ...(username && password ? { auth: { username, password } } : {}),
        };
      },
    }),
    forwardRef(() => CategoriesModule),
    ScheduleModule.forRoot(),
  ],
  controllers: [SearchController],
  providers: [
    SearchIndexService,
    SearchSyncService,
    SearchService,
    SearchReconciliationService,
  ],
  exports: [SearchIndexService, SearchSyncService, SearchService],
})
export class SearchModule {}
