import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchSortOption } from './dto/search-query.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: jest.Mocked<Partial<SearchService>>;

  beforeEach(async () => {
    searchService = {
      search: jest.fn(),
      suggestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchService }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  describe('GET /search', () => {
    it('should call searchService.search with query params', async () => {
      const mockResult = {
        items: [{ _id: '1', title: 'Test' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      (searchService.search as jest.Mock).mockResolvedValue(mockResult);

      const query = { q: 'phone', page: 1, limit: 20 };
      const result = await controller.search(query);

      expect(searchService.search).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should pass all filter params to service', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const query = {
        q: 'car',
        category: 'vehicles',
        priceMin: 100,
        priceMax: 5000,
        condition: 'used',
        lat: 31.5,
        lng: 74.3,
        radius: 50,
        dateFrom: '2024-01-01',
        sort: SearchSortOption.PRICE_ASC,
        page: 2,
        limit: 10,
      };

      await controller.search(query);

      expect(searchService.search).toHaveBeenCalledWith(query);
    });

    it('should return no-results response with suggestions', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        suggestions: ['popular term'],
        relatedCategories: ['cat1'],
      };
      (searchService.search as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.search({ q: 'nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.suggestions).toContain('popular term');
      expect(result.relatedCategories).toContain('cat1');
    });
    it('should pass category-specific filters to service', async () => {
      (searchService.search as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const query = {
        q: 'phone',
        category: 'phones',
        filters: { brand: 'Apple', storage: '256GB' },
      };

      await controller.search(query);

      expect(searchService.search).toHaveBeenCalledWith(query);
      const passedQuery = (searchService.search as jest.Mock).mock.calls[0][0];
      expect(passedQuery.filters).toEqual({ brand: 'Apple', storage: '256GB' });
    });
  });

  describe('GET /search/suggestions', () => {
    it('should call searchService.suggestions with query', async () => {
      const mockResult = { suggestions: ['iPhone 15', 'iPhone 14'] };
      (searchService.suggestions as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.suggestions({ q: 'iph' });

      expect(searchService.suggestions).toHaveBeenCalledWith({ q: 'iph' });
      expect(result.suggestions).toEqual(['iPhone 15', 'iPhone 14']);
    });

    it('should return popular searches when no query', async () => {
      const mockResult = { suggestions: ['trending1', 'trending2'] };
      (searchService.suggestions as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.suggestions({});

      expect(searchService.suggestions).toHaveBeenCalledWith({});
      expect(result.suggestions).toEqual(['trending1', 'trending2']);
    });
  });
});
