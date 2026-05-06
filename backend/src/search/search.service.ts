import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { CategoriesService } from '../categories/categories.service.js';
import { AttributeType } from '../categories/schemas/category.schema.js';
import {
  escapeRegex,
  exactMatchRegex,
} from '../common/utils/sanitize-regex.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { LISTINGS_INDEX } from './search-index.service.js';
import { SearchSyncService } from './search-sync.service.js';
import { SearchQueryDto, SearchSortOption } from './dto/search-query.dto.js';
import { SuggestionQueryDto } from './dto/suggestion-query.dto.js';
import { CACHE_TTL_POPULAR_SEARCHES } from '../common/constants/index.js';
import {
  SearchResult,
  SuggestionResult,
  RankingConfig,
  DEFAULT_RANKING_CONFIG,
} from './search.types.js';

const POPULAR_SEARCHES_KEY = 'search:popular';
const DEFAULT_GEO_RADIUS_KM = 25;

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
      const result = await this.esSearch(query, page, limit);

      // Progressive relaxation: if few results and filters can be relaxed
      if (result.total < limit && query.q && this.hasRelaxableFilters(query)) {
        const relaxed = await this.searchWithRelaxation(
          query,
          page,
          limit,
          result,
        );
        return relaxed;
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
        };
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      this.logger.warn('Falling back to MongoDB search');
      return this.mongoFallbackSearch(query, page, limit);
    }
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
    const from = (page - 1) * limit;
    const rankingConfig = this.parseRankingConfig(query.rankingConfig, query);
    const baseQuery = await this.buildSearchQuery(query, rankingConfig);
    const boostedQuery = this.searchSyncService.buildFeaturedBoostQuery(
      baseQuery,
      rankingConfig,
    );
    const sortClause = this.buildSortClause(query.sort);

    const response = await this.esService.search({
      index: LISTINGS_INDEX,
      from,
      size: limit,
      query: boostedQuery,
      sort: sortClause,
    });

    const hits = response.hits.hits;
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    // If ES returned no results, fall back to MongoDB
    if (total === 0) {
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

  private async mongoFallbackSearch(
    query: SearchQueryDto,
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    const filter: Record<string, any> = {
      status: ListingStatus.ACTIVE,
      deletedAt: { $exists: false },
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
    if (query.modelId) {
      filter.modelId = new Types.ObjectId(query.modelId);
    }
    if (query.modelName) {
      filter.modelName = exactMatchRegex(query.modelName);
    }
    if (query.variantId) {
      filter.variantId = new Types.ObjectId(query.variantId);
    }

    if (query.verifiedSeller) {
      filter.sellerVerified = true;
    }

    // Dynamic category attribute filters
    if (query.filters && typeof query.filters === 'object') {
      for (const [key, value] of Object.entries(query.filters)) {
        if (
          value &&
          typeof value === 'string' &&
          !key.endsWith('_province') &&
          !key.endsWith('_city')
        ) {
          filter[`categoryAttributes.${key}`] = exactMatchRegex(value);
        }
      }
    }

    let sortObj: Record<string, 1 | -1> = { isFeatured: -1, createdAt: -1 };
    if (query.sort === SearchSortOption.PRICE_ASC)
      sortObj = { isFeatured: -1, 'price.amount': 1 };
    else if (query.sort === SearchSortOption.PRICE_DESC)
      sortObj = { isFeatured: -1, 'price.amount': -1 };
    else if (query.sort === SearchSortOption.NEWEST)
      sortObj = { isFeatured: -1, createdAt: -1 };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((item: any) => ({ ...item, _id: item._id.toString() })),
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

        const attrPath = `categoryAttributes.${filterDef.key}`;

        switch (filterDef.type) {
          case AttributeType.RANGE: {
            const rangeClause: any = {};
            if (typeof value === 'object' && value !== null) {
              if (value.min !== undefined) rangeClause.gte = value.min;
              if (value.max !== undefined) rangeClause.lte = value.max;
            }
            if (Object.keys(rangeClause).length > 0) {
              esFilters.push({ range: { [attrPath]: rangeClause } });
            }
            break;
          }
          case AttributeType.SELECT: {
            esFilters.push({ term: { [attrPath]: value } });
            break;
          }
          case AttributeType.MULTISELECT: {
            esFilters.push({
              terms: { [attrPath]: Array.isArray(value) ? value : [value] },
            });
            break;
          }
          case AttributeType.BOOLEAN: {
            const boolVal = value === true || value === 'true' || value === 1;
            esFilters.push({ term: { [attrPath]: boolVal } });
            break;
          }
          case AttributeType.NUMBER: {
            // Number attributes can be filtered as exact match or range
            if (typeof value === 'object' && value !== null) {
              const rangeClause: any = {};
              if (value.min !== undefined) rangeClause.gte = value.min;
              if (value.max !== undefined) rangeClause.lte = value.max;
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
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to load category filters for ${categoryId}: ${error.message}`,
      );
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
