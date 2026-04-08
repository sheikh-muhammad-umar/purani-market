"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const elasticsearch_1 = require("@nestjs/elasticsearch");
const mongoose_1 = require("@nestjs/mongoose");
const ioredis_1 = require("@nestjs-modules/ioredis");
const mongoose_2 = require("mongoose");
const ioredis_2 = __importDefault(require("ioredis"));
const categories_service_js_1 = require("../categories/categories.service.js");
const category_schema_js_1 = require("../categories/schemas/category.schema.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
const search_index_service_js_1 = require("./search-index.service.js");
const search_sync_service_js_1 = require("./search-sync.service.js");
const search_query_dto_js_1 = require("./dto/search-query.dto.js");
const POPULAR_SEARCHES_KEY = 'search:popular';
const POPULAR_SEARCHES_TTL = 3600;
let SearchService = SearchService_1 = class SearchService {
    esService;
    searchSyncService;
    categoriesService;
    listingModel;
    redis;
    logger = new common_1.Logger(SearchService_1.name);
    constructor(esService, searchSyncService, categoriesService, listingModel, redis) {
        this.esService = esService;
        this.searchSyncService = searchSyncService;
        this.categoriesService = categoriesService;
        this.listingModel = listingModel;
        this.redis = redis;
    }
    async search(query) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        try {
            const from = (page - 1) * limit;
            const baseQuery = await this.buildSearchQuery(query);
            const boostedQuery = this.searchSyncService.buildFeaturedBoostQuery(baseQuery);
            const sortClause = this.buildSortClause(query.sort);
            const response = await this.esService.search({
                index: search_index_service_js_1.LISTINGS_INDEX,
                from,
                size: limit,
                query: boostedQuery,
                sort: sortClause,
            });
            const hits = response.hits.hits;
            const total = typeof response.hits.total === 'number'
                ? response.hits.total
                : response.hits.total?.value ?? 0;
            if (total === 0 && !query.q) {
                const mongoResult = await this.mongoFallbackSearch(query, page, limit);
                if (mongoResult.total > 0)
                    return mongoResult;
            }
            const items = hits.map((hit) => ({
                _id: hit._id,
                _score: hit._score,
                ...hit._source,
            }));
            if (query.q) {
                this.trackSearchTerm(query.q).catch((err) => this.logger.warn(`Failed to track search term: ${err.message}`));
            }
            if (items.length === 0 && query.q) {
                const mongoResult = await this.mongoFallbackSearch(query, page, limit);
                if (mongoResult.total > 0)
                    return mongoResult;
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
        }
        catch (error) {
            this.logger.error(`Search failed: ${error.message}`);
            this.logger.warn('Falling back to MongoDB search');
            return this.mongoFallbackSearch(query, page, limit);
        }
    }
    async mongoFallbackSearch(query, page, limit) {
        const filter = {
            status: product_listing_schema_js_1.ListingStatus.ACTIVE,
            deletedAt: { $exists: false },
        };
        if (query.q) {
            filter.$or = [
                { title: { $regex: query.q, $options: 'i' } },
                { description: { $regex: query.q, $options: 'i' } },
            ];
        }
        if (query.category) {
            filter.categoryPath = query.category;
        }
        if (query.condition) {
            filter.condition = query.condition;
        }
        if (query.priceMin || query.priceMax) {
            filter['price.amount'] = {};
            if (query.priceMin)
                filter['price.amount'].$gte = query.priceMin;
            if (query.priceMax)
                filter['price.amount'].$lte = query.priceMax;
        }
        let sortObj = { createdAt: -1 };
        if (query.sort === 'price_asc')
            sortObj = { 'price.amount': 1 };
        else if (query.sort === 'price_desc')
            sortObj = { 'price.amount': -1 };
        else if (query.sort === 'newest')
            sortObj = { createdAt: -1 };
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.listingModel.find(filter).sort(sortObj).skip(skip).limit(limit).lean().exec(),
            this.listingModel.countDocuments(filter).exec(),
        ]);
        return {
            items: items.map((item) => ({ ...item, _id: item._id.toString() })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async suggestions(query) {
        if (!query.q || query.q.trim().length === 0) {
            const popular = await this.getPopularSearches();
            return { suggestions: popular };
        }
        try {
            const response = await this.esService.search({
                index: search_index_service_js_1.LISTINGS_INDEX,
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
            const matchResponse = await this.esService.search({
                index: search_index_service_js_1.LISTINGS_INDEX,
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
            const titleSuggestions = matchResponse.hits.hits.map((hit) => hit._source.title);
            const uniqueSuggestions = [...new Set(titleSuggestions)].slice(0, 10);
            if (uniqueSuggestions.length < 5) {
                const popular = await this.getPopularSearches();
                const filtered = popular.filter((term) => term.toLowerCase().includes(query.q.toLowerCase()) &&
                    !uniqueSuggestions.includes(term));
                uniqueSuggestions.push(...filtered.slice(0, 5 - uniqueSuggestions.length));
            }
            return { suggestions: uniqueSuggestions };
        }
        catch (error) {
            this.logger.error(`Suggestions failed: ${error.message}`);
            const popular = await this.getPopularSearches();
            return { suggestions: popular };
        }
    }
    async buildSearchQuery(query) {
        const must = [];
        const filter = [];
        filter.push({ term: { status: 'active' } });
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
            if (query.filters && Object.keys(query.filters).length > 0) {
                const categoryFilters = await this.buildCategoryFilters(query.category, query.filters);
                filter.push(...categoryFilters);
            }
        }
        if (query.priceMin !== undefined || query.priceMax !== undefined) {
            const rangeFilter = {};
            if (query.priceMin !== undefined) {
                rangeFilter.gte = query.priceMin;
            }
            if (query.priceMax !== undefined) {
                rangeFilter.lte = query.priceMax;
            }
            filter.push({ range: { 'price.amount': rangeFilter } });
        }
        if (query.condition) {
            filter.push({ term: { condition: query.condition } });
        }
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
    async buildCategoryFilters(categoryId, filters) {
        const esFilters = [];
        try {
            const category = await this.categoriesService.findById(categoryId);
            const filterDefs = category.attributes || [];
            for (const filterDef of filterDefs) {
                const value = filters[filterDef.key];
                if (value === undefined || value === null)
                    continue;
                const attrPath = `categoryAttributes.${filterDef.key}`;
                switch (filterDef.type) {
                    case category_schema_js_1.AttributeType.RANGE: {
                        const rangeClause = {};
                        if (typeof value === 'object' && value !== null) {
                            if (value.min !== undefined)
                                rangeClause.gte = value.min;
                            if (value.max !== undefined)
                                rangeClause.lte = value.max;
                        }
                        if (Object.keys(rangeClause).length > 0) {
                            esFilters.push({ range: { [attrPath]: rangeClause } });
                        }
                        break;
                    }
                    case category_schema_js_1.AttributeType.SELECT: {
                        esFilters.push({ term: { [attrPath]: value } });
                        break;
                    }
                    case category_schema_js_1.AttributeType.MULTISELECT: {
                        esFilters.push({ terms: { [attrPath]: Array.isArray(value) ? value : [value] } });
                        break;
                    }
                    case category_schema_js_1.AttributeType.BOOLEAN: {
                        const boolVal = value === true || value === 'true' || value === 1;
                        esFilters.push({ term: { [attrPath]: boolVal } });
                        break;
                    }
                    case category_schema_js_1.AttributeType.NUMBER: {
                        if (typeof value === 'object' && value !== null) {
                            const rangeClause = {};
                            if (value.min !== undefined)
                                rangeClause.gte = value.min;
                            if (value.max !== undefined)
                                rangeClause.lte = value.max;
                            if (Object.keys(rangeClause).length > 0) {
                                esFilters.push({ range: { [attrPath]: rangeClause } });
                            }
                        }
                        else {
                            esFilters.push({ term: { [attrPath]: value } });
                        }
                        break;
                    }
                    case category_schema_js_1.AttributeType.TEXT: {
                        esFilters.push({ match: { [attrPath]: value } });
                        break;
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to load category filters for ${categoryId}: ${error.message}`);
        }
        return esFilters;
    }
    buildSortClause(sort) {
        switch (sort) {
            case search_query_dto_js_1.SearchSortOption.PRICE_ASC:
                return [{ 'price.amount': { order: 'asc' } }, '_score'];
            case search_query_dto_js_1.SearchSortOption.PRICE_DESC:
                return [{ 'price.amount': { order: 'desc' } }, '_score'];
            case search_query_dto_js_1.SearchSortOption.NEWEST:
                return [{ createdAt: { order: 'desc' } }, '_score'];
            case search_query_dto_js_1.SearchSortOption.RELEVANCE:
            default:
                return ['_score', { createdAt: { order: 'desc' } }];
        }
    }
    async trackSearchTerm(term) {
        const normalized = term.toLowerCase().trim();
        if (normalized.length === 0)
            return;
        await this.redis.zincrby(POPULAR_SEARCHES_KEY, 1, normalized);
        const ttl = await this.redis.ttl(POPULAR_SEARCHES_KEY);
        if (ttl === -1) {
            await this.redis.expire(POPULAR_SEARCHES_KEY, POPULAR_SEARCHES_TTL);
        }
    }
    async getPopularSearches(count = 10) {
        try {
            const results = await this.redis.zrevrange(POPULAR_SEARCHES_KEY, 0, count - 1);
            return results;
        }
        catch {
            return [];
        }
    }
    async getNoResultsAlternatives(queryText) {
        const suggestions = [];
        const relatedCategories = [];
        const popular = await this.getPopularSearches(5);
        suggestions.push(...popular);
        if (queryText) {
            try {
                const catResponse = await this.esService.search({
                    index: search_index_service_js_1.LISTINGS_INDEX,
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
                const buckets = catResponse.aggregations?.related_categories?.buckets || [];
                relatedCategories.push(...buckets.map((b) => b.key));
            }
            catch {
            }
        }
        return { suggestions, relatedCategories };
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = SearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __param(4, (0, ioredis_1.InjectRedis)()),
    __metadata("design:paramtypes", [elasticsearch_1.ElasticsearchService,
        search_sync_service_js_1.SearchSyncService,
        categories_service_js_1.CategoriesService,
        mongoose_2.Model,
        ioredis_2.default])
], SearchService);
//# sourceMappingURL=search.service.js.map