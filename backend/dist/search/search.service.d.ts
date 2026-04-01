import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { CategoriesService } from '../categories/categories.service.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
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
export declare class SearchService {
    private readonly esService;
    private readonly searchSyncService;
    private readonly categoriesService;
    private readonly listingModel;
    private readonly redis;
    private readonly logger;
    constructor(esService: ElasticsearchService, searchSyncService: SearchSyncService, categoriesService: CategoriesService, listingModel: Model<ProductListingDocument>, redis: Redis);
    search(query: SearchQueryDto): Promise<SearchResult>;
    private mongoFallbackSearch;
    suggestions(query: SuggestionQueryDto): Promise<SuggestionResult>;
    buildSearchQuery(query: SearchQueryDto): Promise<any>;
    buildCategoryFilters(categoryId: string, filters: Record<string, any>): Promise<any[]>;
    buildSortClause(sort?: SearchSortOption): any[];
    trackSearchTerm(term: string): Promise<void>;
    getPopularSearches(count?: number): Promise<string[]>;
    getNoResultsAlternatives(queryText?: string): Promise<{
        suggestions: string[];
        relatedCategories: string[];
    }>;
}
