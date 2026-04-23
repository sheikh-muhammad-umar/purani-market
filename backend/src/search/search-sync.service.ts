import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Connection } from 'mongoose';
import {
  LISTINGS_INDEX,
  FEATURED_BOOST_FACTOR,
} from './search-index.service.js';
import { DEFAULT_CURRENCY } from '../common/constants/index.js';

export interface ListingDocument {
  _id: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  categoryId: string;
  categoryPath: string[];
  condition: string;
  categoryAttributes: Record<string, any>;
  location?: {
    type: string;
    coordinates: number[];
    city?: string;
    area?: string;
  };
  isFeatured: boolean;
  status: string;
  sellerId: string;
  createdAt: Date;
  brandId?: string;
  brandName?: string;
  vehicleBrandId?: string;
  vehicleBrandName?: string;
  modelId?: string;
  modelName?: string;
  variantId?: string;
  variantName?: string;
}

@Injectable()
export class SearchSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchSyncService.name);
  private changeStream: any;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly esService: ElasticsearchService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.startChangeStream();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopChangeStream();
  }

  startChangeStream(): void {
    try {
      const collection = this.connection.collection('product_listings');
      this.changeStream = collection.watch([], {
        fullDocument: 'updateLookup',
      });

      this.changeStream.on('change', async (change: any) => {
        try {
          await this.handleChange(change);
        } catch (error) {
          this.logger.error(
            `Error processing change stream event: ${(error as Error).message}`,
          );
        }
      });

      this.changeStream.on('error', (error: Error) => {
        if (
          error.message?.includes('replica set') ||
          error.message?.includes('$changeStream')
        ) {
          this.logger.warn(
            'Change streams require a replica set — skipping real-time sync. Listings will not auto-sync to Elasticsearch.',
          );
          this.stopChangeStream();
          return;
        }
        this.logger.error(`Change stream error: ${error.message}`);
      });

      this.logger.log('MongoDB change stream started for product_listings');
    } catch (error) {
      const msg = (error as Error).message || '';
      if (msg.includes('replica set') || msg.includes('$changeStream')) {
        this.logger.warn(
          'Change streams not supported (standalone MongoDB) — skipping real-time ES sync.',
        );
      } else {
        this.logger.error(`Failed to start change stream: ${msg}`);
      }
    }
  }

  async stopChangeStream(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
      this.logger.log('MongoDB change stream stopped');
    }
  }

  async handleChange(change: any): Promise<void> {
    switch (change.operationType) {
      case 'insert':
        await this.handleInsert(change);
        break;
      case 'update':
      case 'replace':
        await this.handleUpdate(change);
        break;
      case 'delete':
        await this.handleDelete(change);
        break;
      default:
        this.logger.debug(`Unhandled change type: ${change.operationType}`);
    }
  }

  async handleInsert(change: any): Promise<void> {
    const doc = change.fullDocument;
    if (!doc) return;

    const esDoc = this.transformToEsDocument(doc);
    await this.esService.index({
      index: LISTINGS_INDEX,
      id: doc._id.toString(),
      document: esDoc,
    });

    this.logger.debug(`Indexed listing: ${doc._id}`);
  }

  async handleUpdate(change: any): Promise<void> {
    const doc = change.fullDocument;
    if (!doc) return;

    const esDoc = this.transformToEsDocument(doc);
    await this.esService.index({
      index: LISTINGS_INDEX,
      id: doc._id.toString(),
      document: esDoc,
    });

    this.logger.debug(`Updated listing in index: ${doc._id}`);
  }

  async handleDelete(change: any): Promise<void> {
    const docId = change.documentKey._id.toString();

    try {
      await this.esService.delete({
        index: LISTINGS_INDEX,
        id: docId,
      });
      this.logger.debug(`Deleted listing from index: ${docId}`);
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        this.logger.debug(`Listing not found in index for deletion: ${docId}`);
      } else {
        throw error;
      }
    }
  }

  transformToEsDocument(doc: any): Record<string, any> {
    const esDoc: Record<string, any> = {
      title: doc.title,
      description: doc.description,
      price: {
        amount: doc.price?.amount,
        currency: doc.price?.currency || DEFAULT_CURRENCY,
      },
      categoryId: doc.categoryId?.toString(),
      categoryPath: (doc.categoryPath || []).map((id: any) => id.toString()),
      condition: doc.condition,
      categoryAttributes: this.transformCategoryAttributes(
        doc.categoryAttributes,
      ),
      isFeatured: doc.isFeatured || false,
      status: doc.status,
      sellerId: doc.sellerId?.toString(),
      createdAt: doc.createdAt,
      brandId: doc.brandId?.toString(),
      brandName: doc.brandName,
      vehicleBrandId: doc.vehicleBrandId?.toString(),
      vehicleBrandName: doc.vehicleBrandName,
      modelId: doc.modelId?.toString(),
      modelName: doc.modelName,
      variantId: doc.variantId?.toString(),
      variantName: doc.variantName,
    };

    if (doc.location?.coordinates?.length === 2) {
      esDoc.location = {
        lat: doc.location.coordinates[1],
        lon: doc.location.coordinates[0],
      };
    }

    // Location text fields for display and filtering
    esDoc.location_text = {
      province: doc.location?.province,
      city: doc.location?.city,
      area: doc.location?.area,
      blockPhase: doc.location?.blockPhase,
      provinceId: doc.location?.provinceId?.toString(),
      cityId: doc.location?.cityId?.toString(),
      areaId: doc.location?.areaId?.toString(),
    };

    return esDoc;
  }

  private transformCategoryAttributes(attrs: any): Record<string, any> {
    if (!attrs) return {};

    if (attrs instanceof Map) {
      const result: Record<string, any> = {};
      attrs.forEach((value: any, key: string) => {
        result[key] = value;
      });
      return result;
    }

    if (typeof attrs === 'object') {
      return { ...attrs };
    }

    return {};
  }

  async indexListing(doc: any): Promise<void> {
    const esDoc = this.transformToEsDocument(doc);
    await this.esService.index({
      index: LISTINGS_INDEX,
      id: doc._id.toString(),
      document: esDoc,
    });
  }

  async removeListing(listingId: string): Promise<void> {
    try {
      await this.esService.delete({ index: LISTINGS_INDEX, id: listingId });
    } catch (error: any) {
      if (error?.meta?.statusCode !== 404) throw error;
    }
  }

  buildFeaturedBoostQuery(baseQuery: any): any {
    return {
      function_score: {
        query: baseQuery,
        functions: [
          {
            filter: { term: { isFeatured: true } },
            weight: FEATURED_BOOST_FACTOR,
          },
        ],
        boost_mode: 'multiply',
        score_mode: 'sum',
      },
    };
  }
}
