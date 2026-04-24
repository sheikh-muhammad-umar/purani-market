import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

export const LISTINGS_INDEX = 'product_listings';

export const FEATURED_BOOST_FACTOR = 5;

export const listingsIndexSettings = {
  analysis: {
    analyzer: {
      // Splits concatenated tokens like "14pro" → ["14", "pro"]
      word_delimiter_analyzer: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase', 'word_delimiter_filter'],
      },
      // Edge-ngram for type-ahead / partial matching
      edge_ngram_analyzer: {
        type: 'custom' as const,
        tokenizer: 'edge_ngram_tokenizer',
        filter: ['lowercase'],
      },
      // Used at search time for edge-ngram field (avoid double n-gramming)
      edge_ngram_search_analyzer: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['lowercase'],
      },
    },
    tokenizer: {
      edge_ngram_tokenizer: {
        type: 'edge_ngram' as const,
        min_gram: 2,
        max_gram: 15,
        token_chars: ['letter' as const, 'digit' as const],
      },
    },
    filter: {
      word_delimiter_filter: {
        type: 'word_delimiter_graph' as const,
        split_on_numerics: true,
        split_on_case_change: true,
        generate_word_parts: true,
        generate_number_parts: true,
        preserve_original: true,
      },
    },
  },
};

export const listingsIndexMapping = {
  properties: {
    title: {
      type: 'text' as const,
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword' as const, ignore_above: 256 },
        delimited: {
          type: 'text' as const,
          analyzer: 'word_delimiter_analyzer',
        },
        edge_ngram: {
          type: 'text' as const,
          analyzer: 'edge_ngram_analyzer',
          search_analyzer: 'edge_ngram_search_analyzer',
        },
      },
    },
    description: { type: 'text' as const, analyzer: 'standard' },
    'price.amount': { type: 'float' as const },
    'price.currency': { type: 'keyword' as const },
    categoryId: { type: 'keyword' as const },
    categoryPath: { type: 'keyword' as const },
    condition: { type: 'keyword' as const },
    categoryAttributes: { type: 'object' as const, enabled: true },
    location: { type: 'geo_point' as const },
    location_text: {
      type: 'object' as const,
      properties: {
        province: { type: 'keyword' as const },
        city: { type: 'keyword' as const },
        area: { type: 'keyword' as const },
        blockPhase: { type: 'keyword' as const },
        provinceId: { type: 'keyword' as const },
        cityId: { type: 'keyword' as const },
        areaId: { type: 'keyword' as const },
      },
    },
    isFeatured: { type: 'boolean' as const },
    status: { type: 'keyword' as const },
    sellerId: { type: 'keyword' as const },
    createdAt: { type: 'date' as const },
    brandId: { type: 'keyword' as const },
    brandName: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 100 } },
    },
    vehicleBrandId: { type: 'keyword' as const },
    vehicleBrandName: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 100 } },
    },
    modelId: { type: 'keyword' as const },
    modelName: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 100 } },
    },
    variantId: { type: 'keyword' as const },
    variantName: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 150 } },
    },
    selectedFeatures: {
      type: 'text' as const,
      fields: { keyword: { type: 'keyword' as const, ignore_above: 100 } },
    },
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
      settings: listingsIndexSettings,
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
