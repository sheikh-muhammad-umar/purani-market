import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { CategoriesService } from '../categories/categories.service.js';
import { AttributeType } from '../categories/schemas/category.schema.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { LISTINGS_INDEX } from './search-index.service.js';
import { SearchSyncService } from './search-sync.service.js';
import { SearchQueryDto, SearchSortOption } from './dto/search-query.dto.js';
import { SuggestionQueryDto } from './dto/suggestion-query.dto.js';

export interface SearchResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions?: string[];
  relatedCategories?: string[];
}

export interface SuggestionResult {
  suggestions: string[];
}

const POPULAR_SEARCHES_KEY = 'search:popular';
const POPULAR_SEARCHES_TTL = 3600; // 1 hour

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

    // Try Elasticsearch first, fall back to MongoDB
    try {
      const from = (page - 1) * limit;
      const baseQuery = await this.buildSearchQuery(query);
      const boostedQuery =
        this.searchSyncService.buildFeaturedBoostQuery(baseQuery);
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

      // If ES has no data at all (index empty), fall back to MongoDB
      if (total === 0 && !query.q) {
        const mongoResult = await this.mongoFallbackSearch(query, page, limit);
        if (mongoResult.total > 0) return mongoResult;
      }

      const items = hits.map((hit: any) => {
        const source = hit._source;
        // Merge location_text back into location for frontend compatibility
        if (source.location_text) {
          source.location = {
            ...(source.location || {}),
            ...source.location_text,
          };
          delete source.location_text;
        }
        return { _id: hit._id, _score: hit._score, ...source };
      });

      // If ES results are missing location names, fall back to MongoDB
      const missingLocation = items.some((item: any) => !item.location?.city);
      if (missingLocation && items.length > 0) {
        const ids = items.map((item: any) => new Types.ObjectId(item._id));
        const dbListings = await this.listingModel
          .find({ _id: { $in: ids } })
          .lean()
          .exec();
        const dbMap = new Map(
          dbListings.map((l: any) => [l._id.toString(), l]),
        );
        for (const item of items) {
          const dbItem = dbMap.get(item._id);
          if (dbItem?.location) {
            item.location = { ...item.location, ...dbItem.location };
          }
        }
      }

      if (query.q) {
        this.trackSearchTerm(query.q).catch((err) =>
          this.logger.warn(`Failed to track search term: ${err.message}`),
        );
      }

      if (items.length === 0 && query.q) {
        // Try MongoDB before giving up
        const mongoResult = await this.mongoFallbackSearch(query, page, limit);
        if (mongoResult.total > 0) return mongoResult;

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

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      this.logger.warn('Falling back to MongoDB search');
      return this.mongoFallbackSearch(query, page, limit);
    }
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
      filter.$or = [
        { title: { $regex: query.q, $options: 'i' } },
        { description: { $regex: query.q, $options: 'i' } },
        { brandName: { $regex: query.q, $options: 'i' } },
        { modelName: { $regex: query.q, $options: 'i' } },
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
      filter['location.province'] = {
        $regex: new RegExp(`^${query.province}$`, 'i'),
      };
    }
    if (query.cityId) {
      filter['location.cityId'] = new Types.ObjectId(query.cityId);
    } else if (query.city) {
      filter['location.city'] = { $regex: new RegExp(`^${query.city}$`, 'i') };
    }
    if (query.areaId) {
      filter['location.areaId'] = new Types.ObjectId(query.areaId);
    } else if (query.area) {
      filter['location.area'] = { $regex: new RegExp(`^${query.area}$`, 'i') };
    }
    if (query.blockPhase) {
      filter['location.blockPhase'] = {
        $regex: new RegExp(`^${query.blockPhase}$`, 'i'),
      };
    }

    if (query.priceMin || query.priceMax) {
      filter['price.amount'] = {};
      if (query.priceMin) filter['price.amount'].$gte = query.priceMin;
      if (query.priceMax) filter['price.amount'].$lte = query.priceMax;
    }

    if (query.brandId) {
      filter.brandId = new Types.ObjectId(query.brandId);
    }
    if (query.modelName) {
      filter.modelName = { $regex: new RegExp(`^${query.modelName}$`, 'i') };
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
          filter[`categoryAttributes.${key}`] = {
            $regex: new RegExp(`^${value}$`, 'i'),
          };
        }
      }
    }

    let sortObj: Record<string, 1 | -1> = { isFeatured: -1, createdAt: -1 };
    if (query.sort === 'price_asc')
      sortObj = { isFeatured: -1, 'price.amount': 1 };
    else if (query.sort === 'price_desc')
      sortObj = { isFeatured: -1, 'price.amount': -1 };
    else if (query.sort === 'newest')
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
      const response = await this.esService.search({
        index: LISTINGS_INDEX,
        size: 0,
        query: {
          bool: {
            must: [
              {
                prefix: {
                  title: {
                    value: query.q.toLowerCase(),
                  },
                },
              },
            ],
            filter: [{ term: { status: 'active' } }],
          },
        },
        aggs: {
          title_suggestions: {
            terms: {
              field: 'title.keyword',
              size: 10,
            },
          },
        },
      });

      // Fallback: use match query to get titles
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
            filter: [{ term: { status: 'active' } }],
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

  async buildSearchQuery(query: SearchQueryDto): Promise<any> {
    const must: any[] = [];
    const filter: any[] = [];

    // Always filter for active listings
    filter.push({ term: { status: 'active' } });

    // Full-text search on title and description
    if (query.q) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ['title^3', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
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
      const radius = query.radius || 25;
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
      const category = await this.categoriesService.findById(categoryId);
      const filterDefs = category.attributes || [];

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

  async trackSearchTerm(term: string): Promise<void> {
    const normalized = term.toLowerCase().trim();
    if (normalized.length === 0) return;
    await this.redis.zincrby(POPULAR_SEARCHES_KEY, 1, normalized);
    // Set TTL if key is new
    const ttl = await this.redis.ttl(POPULAR_SEARCHES_KEY);
    if (ttl === -1) {
      await this.redis.expire(POPULAR_SEARCHES_KEY, POPULAR_SEARCHES_TTL);
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
