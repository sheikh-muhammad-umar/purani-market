import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { CategoriesService } from '../categories/categories.service.js';
import {
  AttributeType,
  CategoryAttribute,
} from '../categories/schemas/category.schema.js';
import {
  escapeRegex,
  exactMatchRegex,
} from '../common/utils/sanitize-regex.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  esPromotionClauses,
  partitionByPromotion,
  promotedSlotPlan,
} from '../listings/promoted-slots.js';
import { LISTINGS_INDEX, SHORTS_INDEX } from './search-index.service.js';
import { SearchSyncService } from './search-sync.service.js';
import { SearchQueryDto, SearchSortOption } from './dto/search-query.dto.js';
import { SuggestionQueryDto } from './dto/suggestion-query.dto.js';
import { CACHE_TTL_POPULAR_SEARCHES } from '../common/constants/index.js';
import {
  SearchResult,
  SearchFacet,
  SuggestionResult,
  RankingConfig,
  DEFAULT_RANKING_CONFIG,
} from './search.types.js';

const POPULAR_SEARCHES_KEY = 'search:popular';
const DEFAULT_GEO_RADIUS_KM = 25;

/** Attribute types the filter panel can show per-option counts or bounds for. */
const FACETABLE_ATTRIBUTE_TYPES = new Set<string>([
  AttributeType.SELECT,
  AttributeType.MULTISELECT,
  AttributeType.BOOLEAN,
  AttributeType.NUMBER,
  AttributeType.YEAR,
  AttributeType.RANGE,
  AttributeType.PROVINCE_CITY,
]);

/** Upper bound on distinct options returned per facet. */
const FACET_BUCKET_LIMIT = 50;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly searchSyncService: SearchSyncService,
    private readonly categoriesService: CategoriesService,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async search(query: SearchQueryDto): Promise<SearchResult> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    try {
      // Facets are computed alongside the results so the filter panel can show
      // per-option counts. They describe the whole filtered set, so they are
      // independent of paging.
      const [result, facets] = await Promise.all([
        this.esSearch(query, page, limit),
        this.buildFacets(query),
      ]);

      // Progressive relaxation: if few results and filters can be relaxed
      if (result.total < limit && query.q && this.hasRelaxableFilters(query)) {
        const relaxed = await this.searchWithRelaxation(
          query,
          page,
          limit,
          result,
        );
        return { ...relaxed, facets };
      }

      if (result.items.length === 0 && query.q) {
        const alternatives = await this.getNoResultsAlternatives(query.q);
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          suggestions: alternatives.suggestions,
          relatedCategories: alternatives.relatedCategories,
          facets,
        };
      }

      return { ...result, facets };
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      this.logger.warn('Falling back to MongoDB search');
      return this.mongoFallbackSearch(query, page, limit);
    }
  }

  /**
   * Searches active shorts for the global search results page.
   *
   * Kept separate from listing search: the shorts index has a minimal mapping
   * (plain `standard` analyzer, no synonym/delimited/edge-ngram sub-fields, a
   * flat `price` rather than `price.amount`, and no `isFeatured`), so the listing
   * query and sort clauses do not apply. Results are mapped into a partial
   * `ShortVideo` shape the frontend's short-card renders directly.
   *
   * ES-unavailable is not fatal — shorts are a secondary result set, so a
   * failure returns empty rather than erroring the whole search page.
   */
  async searchShorts(query: SearchQueryDto): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const from = (page - 1) * limit;

    const filter: any[] = [{ term: { status: 'active' } }];
    if (query.category && Types.ObjectId.isValid(query.category)) {
      filter.push({ term: { categoryId: query.category } });
    }
    if (query.cityId) {
      filter.push({ term: { 'location_text.cityId': query.cityId } });
    }
    if (query.provinceId) {
      filter.push({ term: { 'location_text.provinceId': query.provinceId } });
    }

    const must: any[] = [];
    if (query.q) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ['title^3', 'description', 'categoryName'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Sort: relevance when searching by text, else newest. Price sort targets
    // the flat `price` field (there is no `price.amount` on this index).
    let sort: any[];
    if (query.sort === SearchSortOption.PRICE_ASC) {
      sort = [{ price: 'asc' }];
    } else if (query.sort === SearchSortOption.PRICE_DESC) {
      sort = [{ price: 'desc' }];
    } else if (query.sort === SearchSortOption.NEWEST || !query.q) {
      sort = [{ createdAt: 'desc' }];
    } else {
      sort = ['_score'];
    }

    const boolQuery = {
      bool: {
        filter,
        ...(must.length ? { must } : {}),
      },
    };

    // When ranking by relevance (a text query with no explicit price/newest
    // sort), fold popularity and freshness into the score so a well-watched,
    // recent short outranks a dead one of equal textual match. Kept out of the
    // explicit price/newest sorts, where the user has asked for a specific order.
    const rankByRelevance =
      sort.length === 1 && sort[0] === '_score' && must.length > 0;

    const scoredQuery = rankByRelevance
      ? {
          function_score: {
            query: boolQuery,
            // Multiply the text score by popularity and recency factors.
            score_mode: 'sum' as const,
            boost_mode: 'multiply' as const,
            functions: [
              // Saturating popularity boost — early views/favourites matter
              // most, and the log dampens runaway counts from dominating.
              {
                field_value_factor: {
                  field: 'viewCount',
                  modifier: 'ln1p' as const,
                  factor: 0.6,
                  missing: 0,
                },
              },
              {
                field_value_factor: {
                  field: 'favoriteCount',
                  modifier: 'ln1p' as const,
                  factor: 1.2,
                  missing: 0,
                },
              },
              // Gentle freshness decay: full weight for ~a week, tapering off
              // over the following month so stale shorts sink slowly.
              {
                gauss: {
                  createdAt: {
                    origin: 'now',
                    scale: '30d',
                    offset: '7d',
                    decay: 0.5,
                  },
                },
              },
            ],
          },
        }
      : boolQuery;

    try {
      const response = await this.esService.search({
        index: SHORTS_INDEX,
        from,
        size: limit,
        query: scoredQuery,
        sort,
      });

      const hits = response.hits.hits;
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const items = hits.map((hit: any) => this.mapShortHit(hit));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      // Secondary result set — never fail the page over shorts.
      this.logger.warn(`Shorts search failed: ${error.message}`);
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  /**
   * Reshapes a flat ES shorts hit into the partial `ShortVideo` the frontend
   * short-card expects (notably a nested `video` object). Fields the index does
   * not store (duration, compressedUrl, currency) are simply absent; the card
   * tolerates that.
   */
  private mapShortHit(hit: any): any {
    const s = hit._source ?? {};
    return {
      _id: hit._id,
      _score: hit._score,
      title: s.title,
      description: s.description,
      categoryName: s.categoryName,
      price: s.price,
      viewCount: s.viewCount ?? 0,
      favoriteCount: s.favoriteCount ?? 0,
      video: {
        url: s.videoUrl,
        thumbnailUrl: s.thumbnailUrl,
      },
      location: s.location_text
        ? {
            province: s.location_text.province,
            city: s.location_text.city,
            area: s.location_text.area,
          }
        : undefined,
      createdAt: s.createdAt,
    };
  }

  /**
   * True when any category attribute filter carries a value the MongoDB
   * fallback cannot express — a range object or a multi-value array.
   */
  private hasNonStringAttributeFilter(query: SearchQueryDto): boolean {
    const filters = query.filters;
    if (!filters || typeof filters !== 'object') return false;
    return Object.values(filters).some(
      (value) => value !== null && typeof value === 'object',
    );
  }

  /**
   * Check if the query has filters that can be progressively relaxed.
   */
  private hasRelaxableFilters(query: SearchQueryDto): boolean {
    return !!(
      query.blockPhase ||
      query.areaId ||
      query.area ||
      query.condition ||
      query.priceMin ||
      query.priceMax
    );
  }

  /**
   * Progressively relax filters to fill the page with results.
   * Relaxation order: blockPhase → area → condition → price range.
   * Original strict results come first, relaxed results fill remaining slots.
   */
  private async searchWithRelaxation(
    query: SearchQueryDto,
    page: number,
    limit: number,
    strictResult: SearchResult,
  ): Promise<SearchResult> {
    const strictIds = new Set(strictResult.items.map((i: any) => i._id));
    const remaining = limit - strictResult.items.length;
    if (remaining <= 0) return strictResult;

    // Build relaxation levels — each removes one more filter
    const relaxationSteps: Partial<SearchQueryDto>[] = [];

    const relaxed = { ...query };
    if (relaxed.blockPhase) {
      relaxed.blockPhase = undefined;
      relaxationSteps.push({ ...relaxed });
    }
    if (relaxed.areaId || relaxed.area) {
      relaxed.areaId = undefined;
      relaxed.area = undefined;
      relaxationSteps.push({ ...relaxed });
    }
    if (relaxed.condition) {
      relaxed.condition = undefined;
      relaxationSteps.push({ ...relaxed });
    }
    if (relaxed.priceMin || relaxed.priceMax) {
      relaxed.priceMin = undefined;
      relaxed.priceMax = undefined;
      relaxationSteps.push({ ...relaxed });
    }

    const allItems = [...strictResult.items];

    for (const relaxedQuery of relaxationSteps) {
      if (allItems.length >= limit) break;

      try {
        const slotsNeeded = limit - allItems.length;
        const relaxedResult = await this.esSearch(
          relaxedQuery as SearchQueryDto,
          1,
          slotsNeeded + strictIds.size, // fetch extra to account for dedup
        );

        for (const item of relaxedResult.items) {
          if (allItems.length >= limit) break;
          if (!strictIds.has(item._id)) {
            strictIds.add(item._id);
            allItems.push({ ...item, _relaxed: true });
          }
        }
      } catch {
        // Skip this relaxation level on error
      }
    }

    return {
      items: allItems,
      total: Math.max(strictResult.total, allItems.length),
      page,
      limit,
      totalPages: Math.ceil(
        Math.max(strictResult.total, allItems.length) / limit,
      ),
    };
  }

  /**
   * Core ES search with result processing.
   */
  private async esSearch(
    query: SearchQueryDto,
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    const rankingConfig = this.parseRankingConfig(query.rankingConfig, query);
    const baseQuery = await this.buildSearchQuery(query, rankingConfig);
    const rankedQuery = this.searchSyncService.buildRankingQuery(
      baseQuery,
      rankingConfig,
    );
    const sortClause = this.buildSortClause(query.sort);

    const { hits, total } = await this.esSearchWithPromotedSlots(
      rankedQuery,
      sortClause,
      page,
      limit,
    );

    // If ES returned no results, fall back to MongoDB. This is a safety net for
    // a stale or partially-synced index, NOT a way to widen a search.
    //
    // It must be skipped when category attribute filters are in play: the Mongo
    // path can only express string equality (see the `typeof value === 'string'`
    // guard in mongoFallbackSearch), so it silently drops range and multi-value
    // filters. The result was that any filter combination legitimately matching
    // nothing came back as the full unfiltered list, which reads to the user as
    // "the filter did nothing".
    if (total === 0 && !this.hasNonStringAttributeFilter(query)) {
      const mongoResult = await this.mongoFallbackSearch(query, page, limit);
      if (mongoResult.total > 0) return mongoResult;
    }

    let items = hits.map((hit: any) => {
      const source = hit._source;
      if (source.location_text) {
        source.location = {
          ...(source.location || {}),
          ...source.location_text,
        };
        delete source.location_text;
      }
      return { _id: hit._id, _score: hit._score, ...source };
    });

    // Filter out low-relevance noise when a text query is provided.
    // Threshold can be overridden by A/B experiments via scoreThreshold or threshold param.
    if (query.q && items.length > 1) {
      const topScore = items[0]._score ?? 0;
      const thresholdPct = query.scoreThreshold ?? query.threshold ?? 0.15;
      const threshold = topScore * thresholdPct;
      if (threshold > 0) {
        items = items.filter((item: any) => (item._score ?? 0) >= threshold);
      }
    }

    // Validate ES results against MongoDB to filter out orphaned documents
    // and enrich missing fields (location, images, sellerVerified).
    if (items.length > 0) {
      const ids = items
        .filter((item: any) => Types.ObjectId.isValid(item._id))
        .map((item: any) => new Types.ObjectId(item._id));
      const dbListings = await this.listingModel
        .find({ _id: { $in: ids } })
        .lean()
        .exec();
      const dbMap = new Map(dbListings.map((l: any) => [l._id.toString(), l]));

      const removedCount = items.filter(
        (item: any) => !dbMap.has(item._id),
      ).length;

      // If any orphans were found the ES index is stale — pagination based on
      // ES totals would be wrong (pages with fewer items than expected, inflated
      // totals, etc.).  Fall back to MongoDB which is the source of truth.
      if (removedCount > 0) {
        this.logger.warn(
          `Found ${removedCount} orphaned ES document(s) not in MongoDB — falling back to MongoDB for accurate pagination`,
        );
        return this.mongoFallbackSearch(query, page, limit);
      }

      // No orphans — enrich from MongoDB data
      for (const item of items) {
        const dbItem = dbMap.get(item._id);
        if (dbItem?.location) {
          item.location = { ...item.location, ...dbItem.location };
        }
        if (!item.images?.length && dbItem?.images?.length) {
          item.images = dbItem.images;
        }
        if (item.sellerVerified === undefined && dbItem) {
          item.sellerVerified = dbItem.sellerVerified ?? false;
        }
      }
    }

    if (query.q) {
      this.trackSearchTerm(query.q).catch((err) =>
        this.logger.warn(`Failed to track search term: ${err.message}`),
      );
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Runs one page of a search as a bounded number of promoted slots followed by
   * organic results.
   *
   * Featured used to be a scoring signal instead (`weight: 5` inside
   * `function_score`), which sounded like a boost but behaved as a gate: the
   * search page's default sort is relevance, and with no text query every
   * document has a base score of 1.0, so the flat +5 put all 2,425 featured
   * listings ahead of all 37,610 organic ones. Pages 1 to 120 came back entirely
   * featured.
   *
   * Costs one extra round trip: a `size: 0` request for the two bucket counts,
   * which the slice offsets depend on, then both pages fetched in parallel.
   */
  private async esSearchWithPromotedSlots(
    rankedQuery: any,
    sortClause: any[],
    page: number,
    limit: number,
  ): Promise<{ hits: any[]; total: number }> {
    const { featuredClause, organicClause } = esPromotionClauses();

    const counts = await this.esService.search({
      index: LISTINGS_INDEX,
      size: 0,
      query: rankedQuery,
      aggs: { promoted: { filter: featuredClause } },
      /**
       * Elasticsearch stops counting at 10,000 by default, which was already
       * capping `totalPages`. The slot plan needs a real total: it infers the
       * organic count as `total - featuredTotal`, and a capped total would make
       * organic look exhausted and tip whole pages back to featured. Cheap on a
       * `size: 0` request, and it fixes the page count as a side effect.
       */
      track_total_hits: true,
    });

    const total =
      typeof counts.hits.total === 'number'
        ? counts.hits.total
        : (counts.hits.total?.value ?? 0);
    const featuredTotal =
      (counts.aggregations?.promoted as { doc_count?: number } | undefined)
        ?.doc_count ?? 0;

    const plan = promotedSlotPlan({ page, limit, total, featuredTotal });

    /** The ranked query narrowed to one side of the partition. */
    const bucket = (clause: Record<string, unknown>) => ({
      bool: { must: [rankedQuery], filter: [clause] },
    });

    const [featured, organic] = await Promise.all([
      plan.featuredTake > 0
        ? this.esService.search({
            index: LISTINGS_INDEX,
            from: plan.featuredSkip,
            size: plan.featuredTake,
            query: bucket(featuredClause),
            sort: sortClause,
          })
        : null,
      plan.organicTake > 0
        ? this.esService.search({
            index: LISTINGS_INDEX,
            from: plan.organicSkip,
            size: plan.organicTake,
            query: bucket(organicClause),
            sort: sortClause,
          })
        : null,
    ]);

    return {
      hits: [...(featured?.hits.hits ?? []), ...(organic?.hits.hits ?? [])],
      total,
    };
  }

  private async mongoFallbackSearch(
    query: SearchQueryDto,
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    // `status: ACTIVE` is sufficient on its own: soft-delete sets `status` and
    // `deletedAt` atomically, so the unindexed `deletedAt` predicate excluded
    // nothing extra while forcing the accompanying countDocuments to fetch every
    // matching document instead of counting from the index.
    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
    };

    if (query.q) {
      const safeQ = escapeRegex(query.q);
      filter.$or = [
        { title: { $regex: safeQ, $options: 'i' } },
        { description: { $regex: safeQ, $options: 'i' } },
        { brandName: { $regex: safeQ, $options: 'i' } },
        { vehicleBrandName: { $regex: safeQ, $options: 'i' } },
        { modelName: { $regex: safeQ, $options: 'i' } },
        { variantName: { $regex: safeQ, $options: 'i' } },
        { selectedFeatures: { $regex: safeQ, $options: 'i' } },
      ];
    }

    if (query.category) {
      filter.categoryPath = Types.ObjectId.isValid(query.category)
        ? new Types.ObjectId(query.category)
        : query.category;
    }

    if (query.condition) {
      filter.condition = query.condition;
    }

    // Location filters (prefer IDs, fallback to names)
    if (query.provinceId) {
      filter['location.provinceId'] = new Types.ObjectId(query.provinceId);
    } else if (query.province) {
      filter['location.province'] = exactMatchRegex(query.province);
    }
    if (query.cityId) {
      filter['location.cityId'] = new Types.ObjectId(query.cityId);
    } else if (query.city) {
      filter['location.city'] = exactMatchRegex(query.city);
    }
    if (query.areaId) {
      filter['location.areaId'] = new Types.ObjectId(query.areaId);
    } else if (query.area) {
      filter['location.area'] = exactMatchRegex(query.area);
    }
    if (query.blockPhase) {
      filter['location.blockPhase'] = exactMatchRegex(query.blockPhase);
    }

    if (query.priceMin || query.priceMax) {
      filter['price.amount'] = {};
      if (query.priceMin) filter['price.amount'].$gte = query.priceMin;
      if (query.priceMax) filter['price.amount'].$lte = query.priceMax;
    }

    if (query.brandId) {
      filter.brandId = new Types.ObjectId(query.brandId);
    }
    if (query.vehicleBrandId) {
      filter.vehicleBrandId = new Types.ObjectId(query.vehicleBrandId);
    }
    // Brand-by-name filter, matching the ES path above. A listing stores the
    // name under either `brandName` or `vehicleBrandName`, so match either.
    if (query.brand && !query.brandId && !query.vehicleBrandId) {
      const brandPattern = exactMatchRegex(query.brand);
      filter.$or = [
        ...((filter.$or as Record<string, unknown>[] | undefined) ?? []),
        { brandName: brandPattern },
        { vehicleBrandName: brandPattern },
      ];
    }
    if (query.modelId) {
      filter.modelId = new Types.ObjectId(query.modelId);
    }
    if (query.modelName) {
      filter.modelName = exactMatchRegex(query.modelName);
    }
    if (query.variantId) {
      filter.variantId = new Types.ObjectId(query.variantId);
    }
    if (query.variantName) {
      filter.variantName = exactMatchRegex(query.variantName);
    }

    if (query.verifiedSeller) {
      filter.sellerVerified = true;
    }

    // Dynamic category attribute filters.
    //
    // Each value is matched against the attribute path itself and against the
    // `province`/`city` sub-paths, because `province_city` attributes are stored
    // as an object while every other string attribute is stored flat. Excluding
    // keys by a `_province`/`_city` suffix (as this did before) silently dropped
    // legitimate attributes whose own key ends that way — `registration_city`
    // being exactly that case, which made the fallback return the whole
    // unfiltered category.
    if (query.filters && typeof query.filters === 'object') {
      const attributeClauses: Record<string, unknown>[] = [];
      for (const [key, value] of Object.entries(query.filters)) {
        if (!value || typeof value !== 'string') continue;
        const pattern = exactMatchRegex(value);
        attributeClauses.push({
          $or: [
            { [`categoryAttributes.${key}`]: pattern },
            { [`categoryAttributes.${key}.city`]: pattern },
            { [`categoryAttributes.${key}.province`]: pattern },
          ],
        });
      }
      if (attributeClauses.length > 0) {
        filter.$and = [
          ...((filter.$and as Record<string, unknown>[] | undefined) ?? []),
          ...attributeClauses,
        ];
      }
    }

    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort === SearchSortOption.PRICE_ASC)
      sortObj = { 'price.amount': 1 };
    else if (query.sort === SearchSortOption.PRICE_DESC)
      sortObj = { 'price.amount': -1 };
    else if (query.sort === SearchSortOption.NEWEST)
      sortObj = { createdAt: -1 };

    /**
     * Featured listings get a bounded number of pinned slots per page, matching
     * the browse and nearby paths.
     *
     * `isFeatured` was the primary sort key here, so whenever Elasticsearch was
     * unavailable search silently changed character: the ES path treats featured
     * as one weighted signal in `buildFeaturedBoostQuery`, while this path put
     * every featured listing ahead of every organic one. Two different answers to
     * the same query depending on the health of a service the caller cannot see.
     */
    const { featuredFilter, organicFilter } = partitionByPromotion(filter);
    const [total, featuredTotal] = await Promise.all([
      this.listingModel.countDocuments(filter).exec(),
      this.listingModel.countDocuments(featuredFilter).exec(),
    ]);

    const plan = promotedSlotPlan({ page, limit, total, featuredTotal });

    const [featured, organic] = await Promise.all([
      plan.featuredTake > 0
        ? this.listingModel
            .find(featuredFilter)
            .sort(sortObj)
            .skip(plan.featuredSkip)
            .limit(plan.featuredTake)
            .lean()
            .exec()
        : [],
      plan.organicTake > 0
        ? this.listingModel
            .find(organicFilter)
            .sort(sortObj)
            .skip(plan.organicSkip)
            .limit(plan.organicTake)
            .lean()
            .exec()
        : [],
    ]);

    return {
      items: [...featured, ...organic].map((item: any) => ({
        ...item,
        _id: item._id.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async suggestions(query: SuggestionQueryDto): Promise<SuggestionResult> {
    if (!query.q || query.q.trim().length === 0) {
      // Return popular searches from Redis
      const popular = await this.getPopularSearches();
      return { suggestions: popular };
    }

    try {
      const matchResponse = await this.esService.search({
        index: LISTINGS_INDEX,
        size: 10,
        query: {
          bool: {
            must: [
              {
                match_phrase_prefix: {
                  title: {
                    query: query.q,
                    max_expansions: 10,
                  },
                },
              },
            ],
            filter: [{ term: { status: ListingStatus.ACTIVE } }],
          },
        },
        _source: ['title'],
      });

      const titleSuggestions = matchResponse.hits.hits.map(
        (hit: any) => hit._source.title as string,
      );

      // Deduplicate and limit
      const uniqueSuggestions = [...new Set(titleSuggestions)].slice(0, 10);

      // Merge with popular searches if few results
      if (uniqueSuggestions.length < 5) {
        const popular = await this.getPopularSearches();
        const filtered = popular.filter(
          (term) =>
            term.toLowerCase().includes(query.q!.toLowerCase()) &&
            !uniqueSuggestions.includes(term),
        );
        uniqueSuggestions.push(
          ...filtered.slice(0, 5 - uniqueSuggestions.length),
        );
      }

      return { suggestions: uniqueSuggestions };
    } catch (error: any) {
      this.logger.error(`Suggestions failed: ${error.message}`);
      // Fallback to popular searches
      const popular = await this.getPopularSearches();
      return { suggestions: popular };
    }
  }

  async buildSearchQuery(
    query: SearchQueryDto,
    ranking: RankingConfig = DEFAULT_RANKING_CONFIG,
  ): Promise<any> {
    const must: any[] = [];
    const filter: any[] = [];

    // Always filter for active listings
    filter.push({ term: { status: ListingStatus.ACTIVE } });

    // Full-text search on title and description
    if (query.q) {
      must.push({
        bool: {
          should: [
            // Exact phrase match gets highest boost — "iphone 14 pro max" as a unit
            {
              match_phrase: {
                title: { query: query.q, boost: ranking.phraseBoost },
              },
            },
            // Word-delimiter match handles "14pro" → "14 pro"
            {
              match: {
                'title.delimited': { query: query.q, boost: 8 },
              },
            },
            // Cross-field match — all terms must be present across title/brand/model
            {
              multi_match: {
                query: query.q,
                fields: [
                  'title^4',
                  'title.keyword^6',
                  'brandName^3',
                  'vehicleBrandName^3',
                  'modelName^3',
                  'variantName^2',
                  'selectedFeatures',
                ],
                type: 'cross_fields',
                operator: 'and',
              },
            },
            // Relaxed match — most terms should match (for partial matches)
            {
              multi_match: {
                query: query.q,
                fields: [
                  'title^3',
                  'description',
                  'brandName^2',
                  'modelName^2',
                  'selectedFeatures',
                ],
                type: 'most_fields',
                minimum_should_match: '75%',
              },
            },
            // Fuzzy match for typo tolerance (low boost)
            {
              multi_match: {
                query: query.q,
                fields: [
                  'title^2',
                  'brandName',
                  'modelName',
                  'selectedFeatures',
                ],
                type: 'best_fields',
                fuzziness: 'AUTO',
                boost: 0.5,
              },
            },
            // Synonym-expanded match (handles "mobile"→"phone", "gaari"→"car", etc.)
            {
              multi_match: {
                query: query.q,
                fields: ['title.synonyms^2', 'description.synonyms'],
                type: 'best_fields',
                boost: ranking.synonymBoost,
              },
            },
            // Edge-ngram for partial / type-ahead matching
            {
              match: {
                'title.edge_ngram': { query: query.q, boost: 1.5 },
              },
            },
            // Prefix match for partial words
            {
              match_phrase_prefix: {
                title: { query: query.q, boost: 3 },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    // Category filter
    if (query.category) {
      filter.push({
        bool: {
          should: [
            { term: { categoryId: query.category } },
            { term: { categoryPath: query.category } },
          ],
          minimum_should_match: 1,
        },
      });

      // Apply dynamic category-specific filters
      if (query.filters && Object.keys(query.filters).length > 0) {
        const categoryFilters = await this.buildCategoryFilters(
          query.category,
          query.filters,
        );
        filter.push(...categoryFilters);
      }
    }

    // Price range filter
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      const rangeFilter: any = {};
      if (query.priceMin !== undefined) {
        rangeFilter.gte = query.priceMin;
      }
      if (query.priceMax !== undefined) {
        rangeFilter.lte = query.priceMax;
      }
      filter.push({ range: { 'price.amount': rangeFilter } });
    }

    // Condition filter
    if (query.condition) {
      filter.push({ term: { condition: query.condition } });
    }

    // Location text filters
    if (query.provinceId) {
      filter.push({ term: { 'location_text.provinceId': query.provinceId } });
    } else if (query.province) {
      filter.push({ term: { 'location_text.province': query.province } });
    }
    if (query.cityId) {
      filter.push({ term: { 'location_text.cityId': query.cityId } });
    } else if (query.city) {
      filter.push({ term: { 'location_text.city': query.city } });
    }
    if (query.areaId) {
      filter.push({ term: { 'location_text.areaId': query.areaId } });
    } else if (query.area) {
      filter.push({ term: { 'location_text.area': query.area } });
    }
    if (query.blockPhase) {
      filter.push({ term: { 'location_text.blockPhase': query.blockPhase } });
    }

    // Location filter (geo_distance)
    if (query.lat !== undefined && query.lng !== undefined) {
      const radius = query.radius || DEFAULT_GEO_RADIUS_KM;
      filter.push({
        geo_distance: {
          distance: `${radius}km`,
          location: {
            lat: query.lat,
            lon: query.lng,
          },
        },
      });
    }

    // Date posted filter
    if (query.dateFrom) {
      filter.push({
        range: {
          createdAt: {
            gte: query.dateFrom,
          },
        },
      });
    }

    // Brand / Model / Variant filters
    if (query.brandId) {
      filter.push({ term: { brandId: query.brandId } });
    }
    if (query.vehicleBrandId) {
      filter.push({ term: { vehicleBrandId: query.vehicleBrandId } });
    }
    // Brand-by-name filter (e.g. `?brand=Apple`). Only applied when no explicit
    // brand id is given. `brandName`/`vehicleBrandName` are indexed as analyzed
    // text with a `.keyword` sub-field; exact match must target the keyword
    // field, and a listing carries only one of the two, so either matching is
    // enough.
    if (query.brand && !query.brandId && !query.vehicleBrandId) {
      filter.push({
        bool: {
          should: [
            { term: { 'brandName.keyword': query.brand } },
            { term: { 'vehicleBrandName.keyword': query.brand } },
          ],
          minimum_should_match: 1,
        },
      });
    }
    if (query.modelId) {
      filter.push({ term: { modelId: query.modelId } });
    }
    if (query.modelName) {
      filter.push({
        match_phrase_prefix: { modelName: query.modelName },
      });
    }
    if (query.variantId) {
      filter.push({ term: { variantId: query.variantId } });
    }
    if (query.variantName) {
      filter.push({
        match_phrase_prefix: { variantName: query.variantName },
      });
    }

    // Verified seller filter
    if (query.verifiedSeller) {
      filter.push({ term: { sellerVerified: true } });
    }

    return {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    };
  }

  async buildCategoryFilters(
    categoryId: string,
    filters: Record<string, any>,
  ): Promise<any[]> {
    const esFilters: any[] = [];

    try {
      const filterDefs =
        await this.categoriesService.getInheritedAttributes(categoryId);

      for (const filterDef of filterDefs) {
        const value = filters[filterDef.key];
        if (value === undefined || value === null) continue;
        esFilters.push(...this.buildAttributeClauses(filterDef, value));
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load category filters for ${categoryId}: ${error.message}`,
      );
    }

    return esFilters;
  }

  /**
   * Per-option result counts for the selected category's filterable attributes.
   *
   * Each facet is aggregated with every *other* active attribute filter applied
   * but its own left out. Applying its own filter too would collapse a
   * single-choice facet to just the chosen option, which is useless for deciding
   * what to pick next; excluding it answers "how many results would I get if I
   * switched this one option".
   *
   * Runs as a separate `size: 0` request and never fails the search: facets are
   * a presentation nicety, so an aggregation problem degrades to no counts
   * rather than an error page.
   */
  async buildFacets(query: SearchQueryDto): Promise<SearchFacet[]> {
    if (!query.category) return [];

    try {
      const filterDefs = await this.categoriesService.getInheritedAttributes(
        query.category,
      );
      const facetable = filterDefs.filter((def) =>
        FACETABLE_ATTRIBUTE_TYPES.has(def.type),
      );
      if (facetable.length === 0) return [];

      const supplied = query.filters ?? {};

      // Clauses for every attribute that currently has a value, keyed so one can
      // be excluded per facet.
      const clausesByKey = new Map<string, any[]>();
      for (const def of filterDefs) {
        const value = supplied[def.key];
        if (value === undefined || value === null) continue;
        clausesByKey.set(def.key, this.buildAttributeClauses(def, value));
      }

      // Base query without any attribute filters; those are reapplied per facet.
      const rankingConfig = this.parseRankingConfig(query.rankingConfig, query);
      const baseQuery = await this.buildSearchQuery(
        { ...query, filters: undefined },
        rankingConfig,
      );

      const aggs: Record<string, any> = {};
      for (const def of facetable) {
        const others: any[] = [];
        for (const [key, clauses] of clausesByKey) {
          if (key === def.key) continue;
          others.push(...clauses);
        }

        const attrPath = `categoryAttributes.${def.key}`;
        const isNumeric =
          def.type === AttributeType.NUMBER ||
          def.type === AttributeType.YEAR ||
          def.type === AttributeType.RANGE;
        // Booleans are indexed as real booleans, so they have no keyword
        // sub-field; everything else exact-matched needs `.keyword`.
        const useRawPath = def.type === AttributeType.BOOLEAN;

        aggs[`facet_${def.key}`] = {
          filter:
            others.length > 0
              ? { bool: { filter: others } }
              : { match_all: {} },
          aggs: {
            values: isNumeric
              ? { stats: { field: attrPath } }
              : {
                  terms: {
                    // Exact-match counts must come from the keyword sub-field;
                    // the analyzed `text` field would bucket per token.
                    field: useRawPath ? attrPath : `${attrPath}.keyword`,
                    size: FACET_BUCKET_LIMIT,
                  },
                },
          },
        };
      }

      const response = await this.esService.search({
        index: LISTINGS_INDEX,
        size: 0,
        query: baseQuery,
        aggs,
      });

      const facets: SearchFacet[] = [];
      for (const def of facetable) {
        const agg = (response.aggregations as any)?.[`facet_${def.key}`];
        const values = agg?.values;
        if (!values) continue;

        if (values.buckets) {
          facets.push({
            key: def.key,
            type: def.type,
            buckets: values.buckets.map((b: any) => ({
              value: String(b.key_as_string ?? b.key),
              count: b.doc_count as number,
            })),
          });
        } else {
          facets.push({
            key: def.key,
            type: def.type,
            min: values.min ?? null,
            max: values.max ?? null,
          });
        }
      }
      return facets;
    } catch (error: any) {
      this.logger.warn(`Failed to build facets: ${error.message}`);
      return [];
    }
  }

  /**
   * ES clauses for a single attribute value.
   *
   * Extracted so the facet aggregations can rebuild the same clauses while
   * leaving one attribute out, which is what lets a facet show the counts of its
   * own alternatives.
   */
  private buildAttributeClauses(
    filterDef: CategoryAttribute,
    value: any,
  ): any[] {
    const esFilters: any[] = [];
    {
      {
        const attrPath = `categoryAttributes.${filterDef.key}`;

        // String attributes are dynamically mapped as `text` + a `.keyword`
        // sub-field. `term`/`terms` are not analyzed, so querying the `text`
        // field for "Petrol" never matches the indexed token "petrol" — these
        // filters silently returned nothing from ES and only appeared to work
        // because the zero-result MongoDB fallback picked them up. Exact-match
        // clauses must target the keyword sub-field.
        const keywordPath = `${attrPath}.keyword`;

        switch (filterDef.type) {
          case AttributeType.RANGE: {
            const rangeClause: any = {};
            if (typeof value === 'object' && value !== null) {
              // An empty string means "no bound set"; passing it through makes
              // ES reject the whole range clause as a malformed number.
              if (value.min !== undefined && value.min !== '')
                rangeClause.gte = value.min;
              if (value.max !== undefined && value.max !== '')
                rangeClause.lte = value.max;
            }
            if (Object.keys(rangeClause).length > 0) {
              esFilters.push({ range: { [attrPath]: rangeClause } });
            }
            break;
          }
          case AttributeType.SELECT: {
            // `term` rejects arrays outright ("[term] query does not support
            // array of values"), which threw for the whole search and dropped
            // every filter via the Mongo fallback. A repeated query param is
            // enough to trigger it, so treat multi-valued input as `terms`.
            if (Array.isArray(value)) {
              if (value.length > 0)
                esFilters.push({ terms: { [keywordPath]: value } });
            } else {
              esFilters.push({ term: { [keywordPath]: value } });
            }
            break;
          }
          case AttributeType.MULTISELECT: {
            const values = (Array.isArray(value) ? value : [value]).filter(
              (v) => v !== '' && v !== null && v !== undefined,
            );
            if (values.length > 0) {
              esFilters.push({ terms: { [keywordPath]: values } });
            }
            break;
          }
          case AttributeType.BOOLEAN: {
            const boolVal = value === true || value === 'true' || value === 1;
            esFilters.push({ term: { [attrPath]: boolVal } });
            break;
          }
          // YEAR behaves exactly like NUMBER: it is stored as a number and the
          // UI offers a from/to pair. It previously had no case at all, so every
          // year filter was silently discarded and the search came back
          // unfiltered.
          case AttributeType.YEAR:
          case AttributeType.NUMBER: {
            // Number attributes can be filtered as exact match or range
            if (typeof value === 'object' && value !== null) {
              const rangeClause: any = {};
              if (value.min !== undefined && value.min !== '')
                rangeClause.gte = value.min;
              if (value.max !== undefined && value.max !== '')
                rangeClause.lte = value.max;
              if (Object.keys(rangeClause).length > 0) {
                esFilters.push({ range: { [attrPath]: rangeClause } });
              }
            } else {
              esFilters.push({ term: { [attrPath]: value } });
            }
            break;
          }
          case AttributeType.TEXT: {
            esFilters.push({ match: { [attrPath]: value } });
            break;
          }
          // Indexed as the most specific place name (see
          // SearchSyncService.flattenAttributeValue), so an exact-match clause on
          // the keyword sub-field is what applies here. This case was missing
          // entirely, which meant choosing a province or city changed the URL and
          // added a chip but never actually narrowed the results.
          case AttributeType.PROVINCE_CITY: {
            const name =
              typeof value === 'object' && value !== null
                ? value.city || value.province
                : value;
            if (typeof name === 'string' && name.trim() !== '') {
              const refPath = `categoryAttributeRefs.${filterDef.key}`;
              // The supplied name may be either a city or a province, so match
              // both levels. `categoryAttributes.<key>` holds only the most
              // specific name, which is why province-only filtering needs the
              // structured companion path.
              esFilters.push({
                bool: {
                  should: [
                    { term: { [keywordPath]: name } },
                    { term: { [`${refPath}.city.keyword`]: name } },
                    { term: { [`${refPath}.province.keyword`]: name } },
                  ],
                  minimum_should_match: 1,
                },
              });
            }
            break;
          }
        }
      }
    }

    return esFilters;
  }

  buildSortClause(sort?: SearchSortOption): any[] {
    switch (sort) {
      case SearchSortOption.PRICE_ASC:
        return [{ 'price.amount': { order: 'asc' } }, '_score'];
      case SearchSortOption.PRICE_DESC:
        return [{ 'price.amount': { order: 'desc' } }, '_score'];
      case SearchSortOption.NEWEST:
        return [{ createdAt: { order: 'desc' } }, '_score'];
      case SearchSortOption.RELEVANCE:
      default:
        return ['_score', { createdAt: { order: 'desc' } }];
    }
  }

  /** Parse ranking config from experiment JSON string, with safe defaults */
  private parseRankingConfig(
    configStr?: string,
    query?: SearchQueryDto,
  ): RankingConfig {
    // Start with defaults
    let config = { ...DEFAULT_RANKING_CONFIG };

    // Override from JSON string if provided
    if (configStr) {
      try {
        const parsed = JSON.parse(configStr);
        config = {
          phraseBoost:
            Number(parsed.phraseBoost) || DEFAULT_RANKING_CONFIG.phraseBoost,
          recencyScale:
            parsed.recencyScale || DEFAULT_RANKING_CONFIG.recencyScale,
          recencyWeight:
            Number(parsed.recencyWeight) ||
            DEFAULT_RANKING_CONFIG.recencyWeight,
          popularityViewWeight:
            Number(parsed.popularityViewWeight) ||
            DEFAULT_RANKING_CONFIG.popularityViewWeight,
          popularityFavWeight:
            Number(parsed.popularityFavWeight) ||
            DEFAULT_RANKING_CONFIG.popularityFavWeight,
          synonymBoost:
            Number(parsed.synonymBoost) || DEFAULT_RANKING_CONFIG.synonymBoost,
        };
      } catch {
        // keep defaults
      }
    }

    // Override from individual query params (A/B experiment params sent directly)
    if (query) {
      if (query.phraseBoost != null) config.phraseBoost = query.phraseBoost;
      if (query.recencyScale != null) config.recencyScale = query.recencyScale;
      if (query.recencyWeight != null)
        config.recencyWeight = query.recencyWeight;
      if (query.popularityViewWeight != null)
        config.popularityViewWeight = query.popularityViewWeight;
      if (query.popularityFavWeight != null)
        config.popularityFavWeight = query.popularityFavWeight;
      if (query.synonymBoost != null) config.synonymBoost = query.synonymBoost;
    }

    return config;
  }

  async trackSearchTerm(term: string): Promise<void> {
    const normalized = term.toLowerCase().trim();
    if (normalized.length === 0) return;
    await this.redis.zincrby(POPULAR_SEARCHES_KEY, 1, normalized);
    // Set TTL if key is new
    const ttl = await this.redis.ttl(POPULAR_SEARCHES_KEY);
    if (ttl === -1) {
      await this.redis.expire(POPULAR_SEARCHES_KEY, CACHE_TTL_POPULAR_SEARCHES);
    }
  }

  async getPopularSearches(count = 10): Promise<string[]> {
    try {
      const results = await this.redis.zrevrange(
        POPULAR_SEARCHES_KEY,
        0,
        count - 1,
      );
      return results;
    } catch {
      return [];
    }
  }

  async getNoResultsAlternatives(
    queryText?: string,
  ): Promise<{ suggestions: string[]; relatedCategories: string[] }> {
    const suggestions: string[] = [];
    const relatedCategories: string[] = [];

    // Get popular searches as alternative suggestions
    const popular = await this.getPopularSearches(5);
    suggestions.push(...popular);

    // If there was a query, try to find related categories
    if (queryText) {
      try {
        const catResponse = await this.esService.search({
          index: LISTINGS_INDEX,
          size: 0,
          query: {
            multi_match: {
              query: queryText,
              fields: ['title', 'description'],
              fuzziness: 'AUTO',
            },
          },
          aggs: {
            related_categories: {
              terms: {
                field: 'categoryId',
                size: 5,
              },
            },
          },
        });

        const buckets =
          (catResponse.aggregations?.related_categories as any)?.buckets || [];
        relatedCategories.push(...buckets.map((b: any) => b.key as string));
      } catch {
        // Ignore aggregation errors
      }
    }

    return { suggestions, relatedCategories };
  }
}
