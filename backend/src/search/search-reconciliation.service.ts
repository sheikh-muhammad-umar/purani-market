import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { CronLock } from '../common/decorators/cron-lock.decorator.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  ShortVideo,
  ShortVideoDocument,
  ShortVideoStatus,
} from '../shorts/schemas/short-video.schema.js';
import { SearchSyncService } from './search-sync.service.js';
import { LISTINGS_INDEX, SHORTS_INDEX } from './search-index.service.js';

/**
 * Lightweight reconciliation between MongoDB and Elasticsearch.
 *
 * Runs daily at 4 AM to catch any documents that drifted out of sync
 * due to transient ES failures, missed change-stream events, or bulk
 * MongoDB operations that bypass per-document sync hooks.
 *
 * Unlike a full re-index, this only touches documents that are actually
 * out of sync — so it's fast and non-destructive.
 */
@Injectable()
export class SearchReconciliationService {
  private readonly logger = new Logger(SearchReconciliationService.name);
  private static readonly BATCH_SIZE = 200;

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(ShortVideo.name)
    private readonly shortVideoModel: Model<ShortVideoDocument>,
    private readonly esService: ElasticsearchService,
    private readonly searchSyncService: SearchSyncService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  @CronLock()
  async reconcile(): Promise<{ removed: number; added: number }> {
    this.logger.log('Starting ES ↔ MongoDB reconciliation…');

    const removed = await this.removeOrphanedEsDocuments();
    const added = await this.indexMissingDocuments();

    if (removed > 0 || added > 0) {
      this.logger.log(
        `Reconciliation complete: removed ${removed} orphaned, added ${added} missing`,
      );
    } else {
      this.logger.log('Reconciliation complete: ES and MongoDB are in sync');
    }

    return { removed, added };
  }

  /**
   * Find ES documents whose IDs don't exist in MongoDB (or are no longer
   * active) and remove them from the index.
   */
  private async removeOrphanedEsDocuments(): Promise<number> {
    let removed = 0;
    let searchAfter: any[] | undefined;

    // Scroll through all ES documents in batches
    while (true) {
      const params: any = {
        index: LISTINGS_INDEX,
        size: SearchReconciliationService.BATCH_SIZE,
        _source: false, // We only need IDs
        sort: [{ _id: 'asc' }],
      };
      if (searchAfter) {
        params.search_after = searchAfter;
      }

      let response: any;
      try {
        response = await this.esService.search(params);
      } catch (err) {
        this.logger.error(
          `ES scroll failed during reconciliation: ${(err as Error).message}`,
        );
        break;
      }

      const hits = response.hits.hits;
      if (hits.length === 0) break;

      const esIds: string[] = hits.map((h: any) => h._id);

      // Check which of these IDs exist as active listings in MongoDB
      const activeInDb = await this.listingModel
        .find({ _id: { $in: esIds }, status: ListingStatus.ACTIVE }, { _id: 1 })
        .lean()
        .exec();
      const activeIdSet = new Set(activeInDb.map((d: any) => d._id.toString()));

      // Remove any ES document not found as active in MongoDB
      const orphanIds = esIds.filter((id) => !activeIdSet.has(id));
      for (const id of orphanIds) {
        try {
          await this.searchSyncService.removeListing(id);
          removed++;
        } catch {
          // Already logged inside removeListing
        }
      }

      searchAfter = hits[hits.length - 1].sort;
    }

    return removed;
  }

  /**
   * Find active MongoDB listings that are missing from the ES index
   * and add them.
   */
  private async indexMissingDocuments(): Promise<number> {
    let added = 0;
    let lastId: string | undefined;

    while (true) {
      const filter: any = { status: ListingStatus.ACTIVE };
      if (lastId) {
        filter._id = { $gt: lastId };
      }

      const listings = await this.listingModel
        .find(filter)
        .sort({ _id: 1 })
        .limit(SearchReconciliationService.BATCH_SIZE)
        .lean()
        .exec();

      if (listings.length === 0) break;

      // Check which of these exist in ES
      const ids = listings.map((l: any) => l._id.toString());
      const existsInEs = await this.checkEsExistence(ids);

      for (const listing of listings) {
        const id = listing._id.toString();
        if (!existsInEs.has(id)) {
          try {
            await this.searchSyncService.indexListing(listing);
            added++;
          } catch (err) {
            this.logger.warn(
              `Failed to index missing listing ${id}: ${(err as Error).message}`,
            );
          }
        }
      }

      lastId = listings[listings.length - 1]._id.toString();
    }

    return added;
  }

  /**
   * Check which IDs exist in the ES index. Returns a Set of existing IDs.
   */
  private async checkEsExistence(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    try {
      const response = await this.esService.mget({
        index: LISTINGS_INDEX,
        ids,
        _source: false,
      });
      for (const doc of response.docs) {
        if ('found' in doc && doc.found) {
          found.add(doc._id);
        }
      }
    } catch (err) {
      this.logger.warn(
        `ES mget failed during reconciliation: ${(err as Error).message}`,
      );
    }
    return found;
  }

  // ─── Shorts ────────────────────────────────────────────────────────────────

  /**
   * Same drift-repair as {@link reconcile}, for the shorts index. Only ACTIVE
   * shorts belong in search, so anything else in the index is an orphan and any
   * active short missing from the index is re-added.
   *
   * Runs half an hour after the listings pass so the two never contend for ES.
   */
  @Cron('30 4 * * *')
  @CronLock()
  async reconcileShorts(): Promise<{ removed: number; added: number }> {
    this.logger.log('Starting ES ↔ MongoDB shorts reconciliation…');

    const removed = await this.removeOrphanedShortDocuments();
    const added = await this.indexMissingShorts();

    if (removed > 0 || added > 0) {
      this.logger.log(
        `Shorts reconciliation complete: removed ${removed} orphaned, added ${added} missing`,
      );
    } else {
      this.logger.log(
        'Shorts reconciliation complete: ES and MongoDB are in sync',
      );
    }

    return { removed, added };
  }

  private async removeOrphanedShortDocuments(): Promise<number> {
    let removed = 0;
    let searchAfter: any[] | undefined;

    while (true) {
      const params: any = {
        index: SHORTS_INDEX,
        size: SearchReconciliationService.BATCH_SIZE,
        _source: false,
        sort: [{ _id: 'asc' }],
      };
      if (searchAfter) {
        params.search_after = searchAfter;
      }

      let response: any;
      try {
        response = await this.esService.search(params);
      } catch (err) {
        this.logger.error(
          `ES scroll failed during shorts reconciliation: ${(err as Error).message}`,
        );
        break;
      }

      const hits = response.hits.hits;
      if (hits.length === 0) break;

      const esIds: string[] = hits.map((h: any) => h._id);

      const activeInDb = await this.shortVideoModel
        .find(
          { _id: { $in: esIds }, status: ShortVideoStatus.ACTIVE },
          { _id: 1 },
        )
        .lean()
        .exec();
      const activeIdSet = new Set(activeInDb.map((d: any) => d._id.toString()));

      const orphanIds = esIds.filter((id) => !activeIdSet.has(id));
      for (const id of orphanIds) {
        try {
          await this.searchSyncService.removeShort(id);
          removed++;
        } catch {
          // Already logged inside removeShort
        }
      }

      searchAfter = hits[hits.length - 1].sort;
    }

    return removed;
  }

  private async indexMissingShorts(): Promise<number> {
    let added = 0;
    let lastId: string | undefined;

    while (true) {
      const filter: any = { status: ShortVideoStatus.ACTIVE };
      if (lastId) {
        filter._id = { $gt: lastId };
      }

      const shorts = await this.shortVideoModel
        .find(filter)
        .sort({ _id: 1 })
        .limit(SearchReconciliationService.BATCH_SIZE)
        .lean()
        .exec();

      if (shorts.length === 0) break;

      const ids = shorts.map((s: any) => s._id.toString());
      const existsInEs = await this.checkShortEsExistence(ids);

      for (const short of shorts) {
        const id = short._id.toString();
        if (!existsInEs.has(id)) {
          try {
            await this.searchSyncService.indexShort(short);
            added++;
          } catch (err) {
            this.logger.warn(
              `Failed to index missing short ${id}: ${(err as Error).message}`,
            );
          }
        }
      }

      lastId = shorts[shorts.length - 1]._id.toString();
    }

    return added;
  }

  private async checkShortEsExistence(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    try {
      const response = await this.esService.mget({
        index: SHORTS_INDEX,
        ids,
        _source: false,
      });
      for (const doc of response.docs) {
        if ('found' in doc && doc.found) {
          found.add(doc._id);
        }
      }
    } catch (err) {
      this.logger.warn(
        `ES mget failed during shorts reconciliation: ${(err as Error).message}`,
      );
    }
    return found;
  }
}
