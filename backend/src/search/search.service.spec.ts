import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SearchSyncService } from './search-sync.service';
import { CategoriesService } from '../categories/categories.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchSortOption } from './dto/search-query.dto';
import { AttributeType } from '../categories/schemas/category.schema';
import { getModelToken } from '@nestjs/mongoose';

describe('SearchService', () => {
  let service: SearchService;
  let esService: jest.Mocked<Partial<ElasticsearchService>>;
  let syncService: jest.Mocked<Partial<SearchSyncService>>;
  let categoriesService: jest.Mocked<Partial<CategoriesService>>;
  let redis: Record<string, jest.Mock>;
  let listingModel: Record<string, jest.Mock>;

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
      getInheritedAttributes: jest.fn().mockResolvedValue([]),
    };

    redis = {
      zincrby: jest.fn().mockResolvedValue('1'),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      zrevrange: jest.fn().mockResolvedValue([]),
    };

    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    listingModel = {
      find: jest.fn().mockReturnValue(mockQuery),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ElasticsearchService, useValue: esService },
        { provide: SearchSyncService, useValue: syncService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: getModelToken('ProductListing'), useValue: listingModel },
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
            {
              _id: '1',
              _score: 5.0,
              _source: {
                title: 'iPhone 15',
                status: 'active',
                location: { city: 'Lahore' },
              },
            },
            {
              _id: '2',
              _score: 3.0,
              _source: {
                title: 'Samsung S24',
                status: 'active',
                location: { city: 'Karachi' },
              },
            },
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
          hits: [
            {
              _id: '1',
              _score: 1,
              _source: { title: 'Car', location: { city: 'Lahore' } },
            },
          ],
        },
      });

      await service.search({ q: 'car', sort: SearchSortOption.PRICE_ASC });

      const callArgs = (esService.search as jest.Mock).mock.calls[0][0];
      expect(callArgs.sort[0]).toEqual({ 'price.amount': { order: 'asc' } });
    });

    it('should fall back to MongoDB when Elasticsearch fails', async () => {
      (esService.search as jest.Mock).mockRejectedValue(
        new Error('ES cluster unavailable'),
      );

      const result = await service.search({ q: 'test' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should not track search term when no query provided', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: '1',
              _score: 1,
              _source: { title: 'Test', location: { city: 'Lahore' } },
            },
          ],
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
          hits: [
            {
              _id: '1',
              _score: 1,
              _source: { title: 'Test', location: { city: 'Lahore' } },
            },
          ],
        },
      });

      await service.search({ q: 'laptop' });

      // Give async tracking time to execute
      await new Promise((r) => setTimeout(r, 50));
      expect(redis.zincrby).toHaveBeenCalledWith('search:popular', 1, 'laptop');
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
      const mustClause = query.bool.must[0];
      expect(mustClause).toHaveProperty('bool');
      expect(mustClause.bool.should.length).toBeGreaterThanOrEqual(2);
      // Should contain match_phrase for exact boost
      const phraseMatch = mustClause.bool.should.find(
        (s: any) => s.match_phrase?.title,
      );
      expect(phraseMatch).toBeDefined();
      // Should contain multi_match with most_fields
      const multiMatch = mustClause.bool.should.find((s: any) => s.multi_match);
      expect(multiMatch).toBeDefined();
      expect(multiMatch.multi_match.query).toBe('phone');
      expect(multiMatch.multi_match.type).toBe('most_fields');
      expect(multiMatch.multi_match.fields).toContain('title^3');
      expect(multiMatch.multi_match.fields).toContain('selectedFeatures^1.5');
    });

    it('should add category filter', async () => {
      const query = await service.buildSearchQuery({ category: 'cat123' });
      const catFilter = query.bool.filter.find((f: any) => f.bool?.should);
      expect(catFilter).toBeDefined();
      expect(catFilter.bool.should).toContainEqual({
        term: { categoryId: 'cat123' },
      });
      expect(catFilter.bool.should).toContainEqual({
        term: { categoryPath: 'cat123' },
      });
    });

    it('should add price range filter', async () => {
      const query = await service.buildSearchQuery({
        priceMin: 100,
        priceMax: 500,
      });
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
      const geoFilter = query.bool.filter.find((f: any) => f.geo_distance);
      expect(geoFilter).toBeDefined();
      expect(geoFilter.geo_distance.distance).toBe('50km');
      expect(geoFilter.geo_distance.location.lat).toBe(31.5204);
      expect(geoFilter.geo_distance.location.lon).toBe(74.3587);
    });

    it('should default radius to 25km', async () => {
      const query = await service.buildSearchQuery({ lat: 31.5, lng: 74.3 });
      const geoFilter = query.bool.filter.find((f: any) => f.geo_distance);
      expect(geoFilter.geo_distance.distance).toBe('25km');
    });

    it('should add dateFrom filter', async () => {
      const query = await service.buildSearchQuery({ dateFrom: '2024-01-01' });
      const dateFilter = query.bool.filter.find((f: any) => f.range?.createdAt);
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
      const mustClause = query.bool.must[0];
      expect(
        mustClause.bool.should.find((s: any) => s.multi_match).multi_match
          .query,
      ).toBe('car');
    });
  });

  describe('buildCategoryFilters', () => {
    it('should build range filter for category filter type RANGE', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Mileage',
            key: 'mileage',
            type: AttributeType.RANGE,
            rangeMin: 0,
            rangeMax: 500000,
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        mileage: { min: 0, max: 50000 },
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        range: { 'categoryAttributes.mileage': { gte: 0, lte: 50000 } },
      });
    });

    it('should build term filter for category filter type SELECT', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Brand',
            key: 'brand',
            type: AttributeType.SELECT,
            options: ['Apple', 'Samsung'],
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Apple',
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.brand': 'Apple' },
      });
    });

    it('should build terms filter for category filter type MULTISELECT', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Color',
            key: 'color',
            type: AttributeType.MULTISELECT,
            options: ['Red', 'Blue', 'Black'],
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        color: ['Red', 'Blue'],
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        terms: { 'categoryAttributes.color': ['Red', 'Blue'] },
      });
    });

    it('should wrap single value in array for MULTISELECT', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Color',
            key: 'color',
            type: AttributeType.MULTISELECT,
            options: ['Red', 'Blue'],
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        color: 'Red',
      });

      expect(filters[0]).toEqual({
        terms: { 'categoryAttributes.color': ['Red'] },
      });
    });

    it('should build boolean filter for category filter type BOOLEAN', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Negotiable',
            key: 'negotiable',
            type: AttributeType.BOOLEAN,
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        negotiable: true,
      });

      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.negotiable': true },
      });
    });

    it('should handle string "true" for BOOLEAN filter', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Negotiable',
            key: 'negotiable',
            type: AttributeType.BOOLEAN,
          },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        negotiable: 'true',
      });

      expect(filters[0]).toEqual({
        term: { 'categoryAttributes.negotiable': true },
      });
    });

    it('should skip filters with undefined or null values', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Brand',
            key: 'brand',
            type: AttributeType.SELECT,
            options: ['Apple'],
          },
          { name: 'Mileage', key: 'mileage', type: AttributeType.RANGE },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        brand: undefined,
        mileage: null,
      });

      expect(filters).toHaveLength(0);
    });

    it('should only apply filters matching category filter definitions', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Brand',
            key: 'brand',
            type: AttributeType.SELECT,
            options: ['Apple'],
          },
        ],
      );

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
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Brand',
            key: 'brand',
            type: AttributeType.SELECT,
            options: ['Toyota', 'Honda'],
          },
          {
            name: 'Mileage',
            key: 'mileage',
            type: AttributeType.RANGE,
            rangeMin: 0,
            rangeMax: 500000,
          },
          { name: 'Automatic', key: 'automatic', type: AttributeType.BOOLEAN },
        ],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Toyota',
        mileage: { min: 10000, max: 100000 },
        automatic: true,
      });

      expect(filters).toHaveLength(3);
    });

    it('should return empty array and log warning when category not found', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockRejectedValue(
        new Error('Category not found'),
      );

      const filters = await service.buildCategoryFilters('invalid', {
        brand: 'Apple',
      });

      expect(filters).toHaveLength(0);
    });

    it('should return empty array when category has no filters', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [],
      );

      const filters = await service.buildCategoryFilters('cat1', {
        brand: 'Apple',
      });

      expect(filters).toHaveLength(0);
    });
  });

  describe('buildSearchQuery with category filters', () => {
    it('should include category-specific filters when category and filters provided', async () => {
      (categoriesService.getInheritedAttributes as jest.Mock).mockResolvedValue(
        [
          {
            name: 'Brand',
            key: 'brand',
            type: AttributeType.SELECT,
            options: ['Apple', 'Samsung'],
          },
        ],
      );

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
      expect(categoriesService.getInheritedAttributes).not.toHaveBeenCalled();
    });

    it('should not apply category filters when filters object is empty', async () => {
      const query = await service.buildSearchQuery({
        category: 'phones',
        filters: {},
      });

      // status + category = 2 filters
      expect(query.bool.filter.length).toBe(2);
      expect(categoriesService.getInheritedAttributes).not.toHaveBeenCalled();
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
        hits: {
          total: { value: 1 },
          hits: [{ _id: '1', _source: { title: 'iPhone 15' } }],
        },
      });
      redis.zrevrange.mockResolvedValue([
        'iphone deals',
        'iphone cases',
        'samsung',
      ]);

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

      expect(redis.zincrby).toHaveBeenCalledWith('search:popular', 1, 'iphone');
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

  // ═══════════════════════════════════════════════════════════════
  // COMPREHENSIVE SEARCH SCENARIOS
  // ═══════════════════════════════════════════════════════════════

  describe('multi-word search queries', () => {
    it('should match "iphone 14 Pro" using phrase + multi_match', async () => {
      const query = await service.buildSearchQuery({ q: 'iphone 14 Pro' });
      const mustClause = query.bool.must[0];
      // Should have phrase match for exact title boost
      const phraseMatch = mustClause.bool.should.find(
        (s: any) => s.match_phrase?.title,
      );
      expect(phraseMatch.match_phrase.title.query).toBe('iphone 14 Pro');
      expect(phraseMatch.match_phrase.title.boost).toBe(10);
      // Should have multi_match with most_fields
      const multiMatch = mustClause.bool.should.find((s: any) => s.multi_match);
      expect(multiMatch.multi_match.type).toBe('most_fields');
      // Should have prefix match for partial
      const prefixMatch = mustClause.bool.should.find(
        (s: any) => s.match_phrase_prefix?.title,
      );
      expect(prefixMatch).toBeDefined();
    });

    it('should match partial model names like "14 Pro"', async () => {
      const query = await service.buildSearchQuery({ q: '14 Pro' });
      const multiMatch = query.bool.must[0].bool.should.find(
        (s: any) => s.multi_match,
      );
      expect(multiMatch.multi_match.fields).toContain('modelName^2');
    });

    it('should search across features', async () => {
      const query = await service.buildSearchQuery({ q: 'bluetooth' });
      const multiMatch = query.bool.must[0].bool.should.find(
        (s: any) => s.multi_match,
      );
      expect(multiMatch.multi_match.fields).toContain('selectedFeatures^1.5');
    });
  });

  describe('location-based search', () => {
    it('should filter by provinceId', async () => {
      const query = await service.buildSearchQuery({
        provinceId: 'prov123',
      });
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.provinceId': 'prov123' },
      });
    });

    it('should filter by cityId', async () => {
      const query = await service.buildSearchQuery({ cityId: 'city456' });
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.cityId': 'city456' },
      });
    });

    it('should filter by areaId', async () => {
      const query = await service.buildSearchQuery({ areaId: 'area789' });
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.areaId': 'area789' },
      });
    });

    it('should prefer ID filters over name filters', async () => {
      const query = await service.buildSearchQuery({
        provinceId: 'prov123',
        province: 'Punjab',
      });
      const provFilters = query.bool.filter.filter(
        (f: any) =>
          f.term?.['location_text.provinceId'] ||
          f.term?.['location_text.province'],
      );
      expect(provFilters).toHaveLength(1);
      expect(provFilters[0]).toEqual({
        term: { 'location_text.provinceId': 'prov123' },
      });
    });

    it('should fall back to name filter when no ID provided', async () => {
      const query = await service.buildSearchQuery({ city: 'Lahore' });
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.city': 'Lahore' },
      });
    });

    it('should filter by blockPhase', async () => {
      const query = await service.buildSearchQuery({
        blockPhase: 'Block A',
      });
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.blockPhase': 'Block A' },
      });
    });

    it('should combine text search with location filter', async () => {
      const query = await service.buildSearchQuery({
        q: 'car',
        cityId: 'city456',
      });
      expect(query.bool.must).toHaveLength(1);
      expect(query.bool.filter).toContainEqual({
        term: { 'location_text.cityId': 'city456' },
      });
    });

    it('should combine geo_distance with text location filters', async () => {
      const query = await service.buildSearchQuery({
        lat: 31.52,
        lng: 74.35,
        cityId: 'city456',
      });
      const geoFilter = query.bool.filter.find((f: any) => f.geo_distance);
      const cityFilter = query.bool.filter.find(
        (f: any) => f.term?.['location_text.cityId'],
      );
      expect(geoFilter).toBeDefined();
      expect(cityFilter).toBeDefined();
    });
  });

  describe('filter combinations', () => {
    it('should combine text + category + price + condition + location', async () => {
      const query = await service.buildSearchQuery({
        q: 'honda civic',
        category: 'cars',
        priceMin: 500000,
        priceMax: 2000000,
        condition: 'used',
        cityId: 'city123',
      });
      // status + category + price + condition + city = 5 filters
      expect(query.bool.filter.length).toBe(5);
      expect(query.bool.must).toHaveLength(1);
    });

    it('should handle price range with only min', async () => {
      const query = await service.buildSearchQuery({ priceMin: 1000 });
      const priceFilter = query.bool.filter.find(
        (f: any) => f.range?.['price.amount'],
      );
      expect(priceFilter.range['price.amount']).toEqual({ gte: 1000 });
    });

    it('should handle price range with only max', async () => {
      const query = await service.buildSearchQuery({ priceMax: 50000 });
      const priceFilter = query.bool.filter.find(
        (f: any) => f.range?.['price.amount'],
      );
      expect(priceFilter.range['price.amount']).toEqual({ lte: 50000 });
    });

    it('should filter by brand and model together', async () => {
      const query = await service.buildSearchQuery({
        vehicleBrandId: 'brand1',
        modelId: 'model1',
      });
      expect(query.bool.filter).toContainEqual({
        term: { vehicleBrandId: 'brand1' },
      });
      expect(query.bool.filter).toContainEqual({
        term: { modelId: 'model1' },
      });
    });

    it('should filter by modelName with phrase prefix', async () => {
      const query = await service.buildSearchQuery({
        modelName: 'Civic',
      });
      expect(query.bool.filter).toContainEqual({
        match_phrase_prefix: { modelName: 'Civic' },
      });
    });

    it('should filter by dateFrom', async () => {
      const query = await service.buildSearchQuery({
        dateFrom: '2025-01-01',
      });
      const dateFilter = query.bool.filter.find((f: any) => f.range?.createdAt);
      expect(dateFilter.range.createdAt.gte).toBe('2025-01-01');
    });
  });

  describe('MongoDB fallback search', () => {
    it('should fall back to MongoDB when ES returns empty and no query', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const mockItems = [{ _id: 'id1', title: 'Test Item', status: 'active' }];
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockItems),
      };
      listingModel.find.mockReturnValue(mockQuery);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.search({});

      expect(listingModel.find).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('should search selectedFeatures in MongoDB fallback', async () => {
      (esService.search as jest.Mock).mockRejectedValue(new Error('ES down'));

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      listingModel.find.mockReturnValue(mockQuery);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.search({ q: 'bluetooth' });

      const filterArg = listingModel.find.mock.calls[0][0];
      const orConditions = filterArg.$or;
      const featureCondition = orConditions.find(
        (c: any) => c.selectedFeatures,
      );
      expect(featureCondition).toBeDefined();
      expect(featureCondition.selectedFeatures.$regex).toBe('bluetooth');
    });

    it('should apply location filters in MongoDB fallback', async () => {
      (esService.search as jest.Mock).mockRejectedValue(new Error('ES down'));

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      listingModel.find.mockReturnValue(mockQuery);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.search({ cityId: '507f1f77bcf86cd799439011' });

      const filterArg = listingModel.find.mock.calls[0][0];
      expect(filterArg['location.cityId']).toBeDefined();
    });

    it('should apply sort in MongoDB fallback', async () => {
      (esService.search as jest.Mock).mockRejectedValue(new Error('ES down'));

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      listingModel.find.mockReturnValue(mockQuery);
      listingModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.search({ sort: SearchSortOption.PRICE_ASC });

      expect(mockQuery.sort).toHaveBeenCalledWith({
        isFeatured: -1,
        'price.amount': 1,
      });
    });
  });

  describe('search result processing', () => {
    it('should merge location_text into location for frontend', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: '1',
              _score: 5,
              _source: {
                title: 'Test',
                location_text: { city: 'Lahore', province: 'Punjab' },
              },
            },
          ],
        },
      });

      const result = await service.search({ q: 'test' });

      expect((result.items[0].location as any)?.city).toBe('Lahore');
      expect((result.items[0].location as any)?.province).toBe('Punjab');
      expect(result.items[0].location_text).toBeUndefined();
    });

    it('should include _score in results', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: '1',
              _score: 7.5,
              _source: { title: 'High Score', location: { city: 'Lahore' } },
            },
          ],
        },
      });

      const result = await service.search({ q: 'test' });

      expect(result.items[0]._score).toBe(7.5);
    });

    it('should calculate totalPages correctly', async () => {
      (esService.search as jest.Mock).mockResolvedValue({
        hits: {
          total: { value: 55 },
          hits: Array.from({ length: 20 }, (_, i) => ({
            _id: String(i),
            _score: 1,
            _source: { title: `Item ${i}`, location: { city: 'Lahore' } },
          })),
        },
      });

      const result = await service.search({ q: 'test', limit: 20 });

      expect(result.totalPages).toBe(3);
    });
  });
});
