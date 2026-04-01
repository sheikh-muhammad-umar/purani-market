import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

export const LISTINGS_INDEX = 'product_listings';

export const FEATURED_BOOST_FACTOR = 5;

export const listingsIndexMapping = {
  properties: {
    title: { type: 'text' as const, analyzer: 'standard' },
    description: { type: 'text' as const, analyzer: 'standard' },
    'price.amount': { type: 'float' as const },
    'price.currency': { type: 'keyword' as const },
    categoryId: { type: 'keyword' as const },
    categoryPath: { type: 'keyword' as const },
    condition: { type: 'keyword' as const },
    categoryAttributes: { type: 'object' as const, enabled: true },
    location: { type: 'geo_point' as const },
    isFeatured: { type: 'boolean' as const },
    status: { type: 'keyword' as const },
    sellerId: { type: 'keyword' as const },
    createdAt: { type: 'date' as const },
  },
};

@Injectable()
export class SearchIndexService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureIndex();
  }

  async ensureIndex(): Promise<void> {
    try {
      const exists = await this.esService.indices.exists({
        index: LISTINGS_INDEX,
      });

      if (!exists) {
        await this.createIndex();
        this.logger.log(`Created Elasticsearch index: ${LISTINGS_INDEX}`);
      } else {
        this.logger.log(
          `Elasticsearch index already exists: ${LISTINGS_INDEX}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Elasticsearch unavailable — search features disabled. ${(error as Error).message}`,
      );
    }
  }

  async createIndex(): Promise<void> {
    await this.esService.indices.create({
      index: LISTINGS_INDEX,
      mappings: listingsIndexMapping,
    });
  }

  async deleteIndex(): Promise<void> {
    const exists = await this.esService.indices.exists({
      index: LISTINGS_INDEX,
    });
    if (exists) {
      await this.esService.indices.delete({ index: LISTINGS_INDEX });
      this.logger.log(`Deleted Elasticsearch index: ${LISTINGS_INDEX}`);
    }
  }
}
