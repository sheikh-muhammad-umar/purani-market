import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService, SearchParams, SearchResponse, SearchSuggestion } from './search.service';
import { ApiService } from './api.service';

describe('SearchService', () => {
  let service: SearchService;
  let apiMock: { get: ReturnType<typeof vi.fn> };

  const mockSearchResponse: SearchResponse = {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    featuredAds: [],
    suggestions: [],
    relatedCategories: [],
  };

  beforeEach(() => {
    apiMock = {
      get: vi.fn().mockReturnValue(of(mockSearchResponse)),
    };
    service = new SearchService(apiMock as unknown as ApiService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should call /search with cleaned params', () => {
    const params: SearchParams = {
      q: 'phone',
      category: 'cat1',
      sort: 'price_asc',
      page: 1,
      limit: 20,
    };
    service.search(params).subscribe();
    expect(apiMock.get).toHaveBeenCalledWith('/search', {
      q: 'phone',
      category: 'cat1',
      sort: 'price_asc',
      page: 1,
      limit: 20,
    });
  });

  it('should strip undefined and empty params', () => {
    const params: SearchParams = { q: 'car', category: '', sort: undefined, page: 1, limit: 20 };
    service.search(params).subscribe();
    expect(apiMock.get).toHaveBeenCalledWith('/search', {
      q: 'car',
      page: 1,
      limit: 20,
    });
  });

  it('should include price range params', () => {
    const params: SearchParams = {
      q: 'laptop',
      minPrice: 1000,
      maxPrice: 5000,
      page: 1,
      limit: 20,
    };
    service.search(params).subscribe();
    expect(apiMock.get).toHaveBeenCalledWith('/search', {
      q: 'laptop',
      minPrice: 1000,
      maxPrice: 5000,
      page: 1,
      limit: 20,
    });
  });

  it('should call /search/suggestions with query', () => {
    const mockSuggestions: SearchSuggestion[] = [
      { term: 'iphone 15', type: 'trending' },
      { term: 'iphone case', type: 'ai' },
    ];
    apiMock.get = vi.fn().mockReturnValue(of(mockSuggestions));

    service.getSuggestions('iphone').subscribe((result) => {
      expect(result).toEqual(mockSuggestions);
    });
    expect(apiMock.get).toHaveBeenCalledWith('/search/suggestions', { q: 'iphone' });
  });

  it('should pass dynamic filter params through', () => {
    const params: SearchParams = {
      q: 'car',
      category: 'vehicles',
      make: 'Toyota',
      model: 'Corolla',
      page: 1,
      limit: 20,
    };
    service.search(params).subscribe();
    expect(apiMock.get).toHaveBeenCalledWith('/search', {
      q: 'car',
      category: 'vehicles',
      make: 'Toyota',
      model: 'Corolla',
      page: 1,
      limit: 20,
    });
  });
});
