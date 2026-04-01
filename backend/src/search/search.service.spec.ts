import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';
import { CategoriesService } from '../categories/categories.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchSortOption } from './dto/search-query.dto';
import { FilterType } from '../categories/schemas/category.schema';

describe('SearchService', () => {
  let service: SearchService;
  let esService: jest.Mocked<Partial<ElasticsearchService>>;
  let syncService: jest.Mocked<Partial<SearchSyncService>>;
  let categoriesService: jest.Mocked<Partial<CategoriesService>>;
  let redis: Record<string, jest.Mock>;

  beforeEach(async () => {
    esService = {
      search: jest.fn(),
    };

    syncService = {
      buildFeaturedBoostQuery: jest.fn((q) => ({
        function_score: { query: q },
      })),
    };

    categoriesService = {
      findById: jest.fn(),
    };

    redis = {
      zincrby: jest.fn().mockResolvedValue('1'),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      zrevrange: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ElasticsearchService, useValue: esService },
        { provide: SearchSyncService, useValue: syncService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('search', () => {
    it('should return search results with pagination', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 2 },
          hits: [
            { _id: '1', _score: 5.0, _source: { title: 'iPhone 15', status: 'active' } },
            { _id: '2', _score: 3.0, _source: { title: 'Samsung S24', status: 'active' } },
          ],
        },
      });

      const result = await service.search({ q: 'phone', page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.items[0]._id).toBe('1');
      expect(result.items[0].title).toBe('iPhone 15');
    });

    it('should use featured boost query', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {},
      });

      await service.search({ q: 'car' });

      expect(syncService.buildFeaturedBoostQuery).toHaveBeenCalled();
      const callArgs = (esService.search as jest.Mock).mock.calls[0][0];
      expect(callArgs.query).toHaveProperty('function_score');
    });

    it('should default to page 1 and limit 20', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: {},
      });

      await service.search({ q: 'test' });

      const callArgs = (esService.search as jest.Mock).mock.calls[0][0];
      expect(callArgs.from).toBe(0);
      expect(callArgs.size).toBe(20);
    });

    it('should return no-results alternatives when empty', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: { related_categories: { buckets: [{ key: 'cat1' }] } },
      });
      redis.zrevrange.mockResolvedValue(['popular term']);

      const result = await service.search({ q: 'nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.suggestions).toContain('popular term');
      expect(result.relatedCategories).toContain('cat1');
    });

    it('should pass sort clause to Elasticsearch', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [{ _id: '1', _score: 1, _source: { title: 'Car' } }],
        },
      });

      await service.search({ q: 'car', sort: SearchSortOption.PRICE_ASC });

      const callArgs = (esService.search as jest.Mock).mock.calls[0][0];
      expect(callArgs.sort[0]).toEqual({ 'price.amount': { order: 'asc' } });
    });

    it('should propagate Elasticsearch errors', async () => {
      (esService.search as jest.Mock).mockRejectedValue(
        new Error('ES cluster unavailable'),
      );

      await expect(service.search({ q: 'test' })).rejects.toThrow(
        'ES cluster unavailable',
      );
    });

    it('should not track search term when no query provided', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [{ _id: '1', _score: 1, _source: { title: 'Test' } }],
        },
      });

      await service.search({});

      await new Promise((r) => setTimeout(r, 50));
      expect(redis.zincrby).not.toHaveBeenCalled();
    });

    it('should track search terms when query is provided', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [{ _id: '1', _score: 1, _source: { title: 'Test' } }],
        },
      });

      await service.search({ q: 'laptop' });

      // Give async tracking time to execute
      await new Promise((r) => setTimeout(r, 50));
      expect(redis.zincrby).toHaveBeenCalledWith(
        'search:popular',
        1,
        'laptop',
      );
    });
  });

  describe('buildSearchQuery', () => {
    it('should build a match_all query when no q is provided', async () => {
      const query = await service.buildSearchQuery({});
      expect(query.bool.must).toEqual([{ match_all: {} }]);
      expect(query.bool.filter).toContainEqual({ term: { status: 'active' } });
    });

    it('should build a multi_match query when q is provided', async () => {
      const query = await service.buildSearchQuery({ q: 'phone' });
      expect(query.bool.must[0]).toHaveProperty('multi_match');
      expect(query.bool.must[0].multi_match.query).toBe('phone');
      expect(query.bool.must[0].multi_match.fields).toContain('title^3');
    });

    it('should add category filter', async () => {
      const query = await service.buildSearchQuery({ category: 'cat123' });
      const catFilter = query.bool.filter.find(
        (f: any) => f.bool?.should,
      );
      expect(catFilter).toBeDefined();
      expect(catFilter.bool.should).toContainEqual({
        term: { categoryId: 'cat123' },
      });
      expect(catFilter.bool.should).toContainEqual({
        term: { categoryPath: 'cat123' },
      });
    });

    it('should add price range filter', async () => {
      const query = await service.buildSearchQuery({ priceMin: 100, priceMax: 500 });
      const priceFilter = query.bool.filter.find(
        (f: any) => f.range?.['price.amount'],
      );
      expect(priceFilter).toBeDefined();
      expect(priceFilter.range['price.amount'].gte).toBe(100);
      expect(priceFilter.range['price.amount'].lte).toBe(500);
    });

    it('should add price range filter with only priceMin', async () => {
      const query = await service.buildSearchQuery({ priceMin: 100 });
      const priceFilter = query.bool.filter.find(
        (f: any) => f.range?.['price.amount'],
      );
      expect(priceFilter).toBeDefined();
      expect(priceFilter.range['price.amount'].gte).toBe(100);
      expect(priceFilter.range['price.amount'].lte).toBeUndefined();
    });

    it('should add price range filter with only priceMax', async () => {
      const query = await service.buildSearchQuery({ priceMax: 500 });
      const priceFilter = query.bool.filter.find(
        (f: any) => f.range?.['price.amount'],
      );
      expect(priceFilter).toBeDefined();
      expect(priceFilter.range['price.amount'].lte).toBe(500);
      expect(priceFilter.range['price.amount'].gte).toBeUndefined();
    });

    it('should add condition filter', async () => {
      const query = await service.buildSearchQuery({ condition: 'new' });
      expect(query.bool.filter).toContainEqual({ term: { condition: 'new' } });
    });

    it('should add geo_distance filter when lat/lng provided', async () => {
      const query = await service.buildSearchQuery({
        lat: 31.5204,
        lng: 74.3587,
        radius: 50,
      });
      const geoFilter = query.bool.filter.find(
        (f: any) => f.geo_distance,
      );
      expect(geoFilter).toBeDefined();
      expect(geoFilter.geo_distance.distance).toBe('50km');
      expect(geoFilter.geo_distance.location.lat).toBe(31.5204);
      expect(geoFilter.geo_distance.location.lon).toBe(74.3587);
    });

    it('should default radius to 25km', async () => {
      const query = await service.buildSearchQuery({ lat: 31.5, lng: 74.3 });
      const geoFilter = query.bool.filter.find(
        (f: any) => f.geo_distance,
      );
      expect(geoFilter.geo_distance.distance).toBe('25km');
    });

    it('should add dateFrom filter', async () => {
      const query = await service.buildSearchQuery({ dateFrom: '2024-01-01' });
      const dateFilter = query.bool.filter.find(
        (f: any) => f.range?.createdAt,
      );
      expect(dateFilter).toBeDefined();
      expect(dateFilter.range.createdAt.gte).toBe('2024-01-01');
    });

    it('should combine multiple filters', async () => {
      const query = await service.buildSearchQuery({
        q: 'car',
        category: 'vehicles',
        priceMin: 1000,
        condition: 'used',
      });
      // status + category + price + condition = 4 filters
      expect(query.bool.filter.length).toBe(4);
      expect(query.bool.must[0].multi_match.query).toBe('car');
    });
  });

  describe('buildCategoryFilters', () => {
    it('should build range filter for category filter type RANGE', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Mileage', key: 'mileage', type: FilterType.RANGE, rangeMin: 0, rangeMax: 500000 },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        mileage: { min: 0, max: 50000 },
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        range: { 'categoryAttributes.mileage': { gte: 0, lte: 50000 } },
      });
    });

    it('should build term filter for category filter type SELECT', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Brand', key: 'brand', type: FilterType.SELECT, options: ['Apple', 'Samsung'] },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Apple',
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.brand': 'Apple' },
      });
    });

    it('should build terms filter for category filter type MULTISELECT', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Color', key: 'color', type: FilterType.MULTISELECT, options: ['Red', 'Blue', 'Black'] },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        color: ['Red', 'Blue'],
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        terms: { 'categoryAttributes.color': ['Red', 'Blue'] },
      });
    });

    it('should wrap single value in array for MULTISELECT', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Color', key: 'color', type: FilterType.MULTISELECT, options: ['Red', 'Blue'] },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        color: 'Red',
      });

      expect(filters[0]).toEqual({
        terms: { 'categoryAttributes.color': ['Red'] },
      });
    });

    it('should build boolean filter for category filter type BOOLEAN', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Negotiable', key: 'negotiable', type: FilterType.BOOLEAN },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        negotiable: true,
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.negotiable': true },
      });
    });

    it('should handle string "true" for BOOLEAN filter', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Negotiable', key: 'negotiable', type: FilterType.BOOLEAN },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        negotiable: 'true',
      });

      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.negotiable': true },
      });
    });

    it('should skip filters with undefined or null values', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Brand', key: 'brand', type: FilterType.SELECT, options: ['Apple'] },
          { name: 'Mileage', key: 'mileage', type: FilterType.RANGE },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        brand: undefined,
        mileage: null,
      });

      expect(filters).toHaveLength(0);
    });

    it('should only apply filters matching category filter definitions', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Brand', key: 'brand', type: FilterType.SELECT, options: ['Apple'] },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Apple',
        unknownFilter: 'value',
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.brand': 'Apple' },
      });
    });

    it('should handle multiple category filters simultaneously', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Brand', key: 'brand', type: FilterType.SELECT, options: ['Toyota', 'Honda'] },
          { name: 'Mileage', key: 'mileage', type: FilterType.RANGE, rangeMin: 0, rangeMax: 500000 },
          { name: 'Automatic', key: 'automatic', type: FilterType.BOOLEAN },
        ],
      });

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Toyota',
        mileage: { min: 10000, max: 100000 },
        automatic: true,
      });

      expect(filters).toHaveLength(3);
    });

    it('should return empty array and log warning when category not found', async () => {
      (categoriesService.findById as jest.Mock).mockRejectedValue(
        new Error('Category not found'),
      );

      const filters = await service.buildCategoryFilters('invalid', { brand: 'Apple' });

      expect(filters).toHaveLength(0);
    });

    it('should return empty array when category has no filters', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [],
      });

      const filters = await service.buildCategoryFilters('cat1', { brand: 'Apple' });

      expect(filters).toHaveLength(0);
    });
  });

  describe('buildSearchQuery with category filters', () => {
    it('should include category-specific filters when category and filters provided', async () => {
      (categoriesService.findById as jest.Mock).mockResolvedValue({
        filters: [
          { name: 'Brand', key: 'brand', type: FilterType.SELECT, options: ['Apple', 'Samsung'] },
        ],
      });

      const query = await service.buildSearchQuery({
        category: 'phones',
        filters: { brand: 'Apple' },
      });

      // status + category + brand = 3 filters
      expect(query.bool.filter.length).toBe(3);
      expect(query.bool.filter).toContainEqual({
        term: { 'categoryAttributes.brand': 'Apple' },
      });
    });

    it('should not apply category filters when no category is selected', async () => {
      const query = await service.buildSearchQuery({
        filters: { brand: 'Apple' },
      });

      // Only status filter
      expect(query.bool.filter.length).toBe(1);
      expect(categoriesService.findById).not.toHaveBeenCalled();
    });

    it('should not apply category filters when filters object is empty', async () => {
      const query = await service.buildSearchQuery({
        category: 'phones',
        filters: {},
      });

      // status + category = 2 filters
      expect(query.bool.filter.length).toBe(2);
      expect(categoriesService.findById).not.toHaveBeenCalled();
    });
  });

  describe('buildSortClause', () => {
    it('should sort by score and date for relevance', () => {
      const sort = service.buildSortClause(SearchSortOption.RELEVANCE);
      expect(sort[0]).toBe('_score');
      expect(sort[1]).toEqual({ createdAt: { order: 'desc' } });
    });

    it('should sort by price ascending', () => {
      const sort = service.buildSortClause(SearchSortOption.PRICE_ASC);
      expect(sort[0]).toEqual({ 'price.amount': { order: 'asc' } });
    });

    it('should sort by price descending', () => {
      const sort = service.buildSortClause(SearchSortOption.PRICE_DESC);
      expect(sort[0]).toEqual({ 'price.amount': { order: 'desc' } });
    });

    it('should sort by newest first', () => {
      const sort = service.buildSortClause(SearchSortOption.NEWEST);
      expect(sort[0]).toEqual({ createdAt: { order: 'desc' } });
    });

    it('should default to relevance when no sort specified', () => {
      const sort = service.buildSortClause(undefined);
      expect(sort[0]).toBe('_score');
    });
  });

  describe('suggestions', () => {
    it('should return popular searches when no query provided', async () => {
      redis.zrevrange.mockResolvedValue(['iphone', 'samsung', 'laptop']);

      const result = await service.suggestions({});

      expect(result.suggestions).toEqual(['iphone', 'samsung', 'laptop']);
    });

    it('should return title-based suggestions for a query', async () => {
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: { title_suggestions: { buckets: [] } },
      });
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            { _id: '1', _source: { title: 'iPhone 15 Pro' } },
            { _id: '2', _source: { title: 'iPhone 14' } },
          ],
        },
      });

      const result = await service.suggestions({ q: 'iph' });

      expect(result.suggestions).toContain('iPhone 15 Pro');
      expect(result.suggestions).toContain('iPhone 14');
    });

    it('should deduplicate suggestions', async () => {
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: { title_suggestions: { buckets: [] } },
      });
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: {
          total: { value: 3 },
          hits: [
            { _id: '1', _source: { title: 'iPhone 15' } },
            { _id: '2', _source: { title: 'iPhone 15' } },
            { _id: '3', _source: { title: 'iPhone 14' } },
          ],
        },
      });

      const result = await service.suggestions({ q: 'iph' });

      expect(result.suggestions).toEqual(['iPhone 15', 'iPhone 14']);
    });

    it('should merge popular searches when few title suggestions found', async () => {
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
        aggregations: { title_suggestions: { buckets: [] } },
      });
      (esService.search as jest.Mock).mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [{ _id: '1', _source: { title: 'iPhone 15' } }],
        },
      });
      redis.zrevrange.mockResolvedValue(['iphone deals', 'iphone cases', 'samsung']);

      const result = await service.suggestions({ q: 'iph' });

      expect(result.suggestions).toContain('iPhone 15');
      expect(result.suggestions).toContain('iphone deals');
      expect(result.suggestions).toContain('iphone cases');
      // 'samsung' should not be included since it doesn't match 'iph'
      expect(result.suggestions).not.toContain('samsung');
    });

    it('should fallback to popular searches on ES error', async () => {
      (esService.search as jest.Mock).mockRejectedValue(
        new Error('ES unavailable'),
      );
      redis.zrevrange.mockResolvedValue(['trending1', 'trending2']);

      const result = await service.suggestions({ q: 'test' });

      expect(result.suggestions).toEqual(['trending1', 'trending2']);
    });
  });

  describe('trackSearchTerm', () => {
    it('should increment search term score in Redis', async () => {
      await service.trackSearchTerm('iPhone');

      expect(redis.zincrby).toHaveBeenCalledWith(
        'search:popular',
        1,
        'iphone',
      );
    });

    it('should set TTL on first tracking', async () => {
      redis.ttl.mockResolvedValue(-1);

      await service.trackSearchTerm('test');

      expect(redis.expire).toHaveBeenCalledWith('search:popular', 3600);
    });

    it('should not set TTL if already set', async () => {
      redis.ttl.mockResolvedValue(1800);

      await service.trackSearchTerm('test');

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should skip empty terms', async () => {
      await service.trackSearchTerm('  ');

      expect(redis.zincrby).not.toHaveBeenCalled();
    });
  });

  describe('getPopularSearches', () => {
    it('should return top searches from Redis', async () => {
      redis.zrevrange.mockResolvedValue(['iphone', 'car', 'laptop']);

      const result = await service.getPopularSearches(3);

      expect(result).toEqual(['iphone', 'car', 'laptop']);
      expect(redis.zrevrange).toHaveBeenCalledWith('search:popular', 0, 2);
    });

    it('should return empty array on Redis error', async () => {
      redis.zrevrange.mockRejectedValue(new Error('Redis down'));

      const result = await service.getPopularSearches();

      expect(result).toEqual([]);
    });
  });
});
