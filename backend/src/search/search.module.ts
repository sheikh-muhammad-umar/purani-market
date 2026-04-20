import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { CategoriesModule } from '../categories/categories.module.js';
import { ProductListing, ProductListingSchema } from '../listings/schemas/product-listing.schema.js';
import { SearchIndexService } from './search-index.service.js';
import { SearchSyncService } from './search-sync.service.js';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProductListing.name, schema: ProductListingSchema }]),
    ElasticsearchModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const username = configService.get<string>('elasticsearch.username');
        const password = configService.get<string>('elasticsearch.password');
        return {
          node: configService.get<string>('elasticsearch.node') || 'http://localhost:9200',
          ...(username && password ? { auth: { username, password } } : {}),
        };
      },
    }),
    forwardRef(() => CategoriesModule),
  ],
  controllers: [SearchController],
  providers: [SearchIndexService, SearchSyncService, SearchService],
  exports: [SearchIndexService, SearchSyncService, SearchService],
})
export class SearchModule {}
