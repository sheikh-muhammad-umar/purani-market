import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convertToParamMap, ParamMap } from '@angular/router';
import { SearchResultsComponent, SortOption, ActiveFilter } from './search-results.component';
import {
  SearchService,
  SearchResponse,
  SearchSuggestion,
} from '../../../core/services/search.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category, Listing, CategoryAttribute } from '../../../core/models';

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    _id: overrides._id ?? '1',
    sellerId: 'seller1',
    title: overrides.title ?? 'Test Listing',
    description: 'A test listing',
    price: overrides.price ?? { amount: 5000, currency: 'PKR' },
    categoryId: 'cat1',
    categoryPath: ['cat1'],
    condition: 'used',
    categoryAttributes: {},
    selectedFeatures: [],
    images: overrides.images ?? [
      { url: 'https://img.test/1.jpg', thumbnailUrl: 'https://img.test/1_thumb.jpg', sortOrder: 0 },
    ],
    video: undefined,
    location: overrides.location ?? {
      type: 'Point',
      coordinates: [74.3, 31.5],
      city: 'Lahore',
      area: 'Gulberg',
    },
    contactInfo: { phone: '03001234567', email: 'test@test.com' },
    status: 'active',
    isFeatured: overrides.isFeatured ?? false,
    viewCount: 0,
    favoriteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    _id: overrides._id ?? 'cat1',
    name: overrides.name ?? 'Cars',
    slug: overrides.slug ?? 'cars',
    level: overrides.level ?? 1,
    attributes: overrides.attributes ?? [],
    features: overrides.features ?? [],
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('SearchResultsComponent', () => {
  let component: SearchResultsComponent;
  let searchServiceMock: {
    search: ReturnType<typeof vi.fn>;
    getSuggestions: ReturnType<typeof vi.fn>;
  };
  let categoriesServiceMock: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let queryParamSubject: BehaviorSubject<ParamMap>;
  let routeMock: { queryParamMap: BehaviorSubject<ParamMap> };

  const mockCategories: Category[] = [
    makeCategory({ _id: 'c1', name: 'Cars', slug: 'cars' }),
    makeCategory({ _id: 'c2', name: 'Phones', slug: 'phones' }),
  ];

  const mockSearchResponse: SearchResponse = {
    data: [
      makeListing({ _id: 'l1', title: 'Honda Civic' }),
      makeListing({ _id: 'l2', title: 'Toyota Corolla' }),
    ],
    total: 2,
    page: 1,
    limit: 20,
    featuredAds: [makeListing({ _id: 'f1', title: 'Featured BMW', isFeatured: true })],
    suggestions: [],
    relatedCategories: [],
  };

  beforeEach(() => {
    searchServiceMock = {
      search: vi.fn().mockReturnValue(of(mockSearchResponse)),
      getSuggestions: vi.fn().mockReturnValue(of([])),
    };

    categoriesServiceMock = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
      getById: vi.fn().mockReturnValue(
        of(
          makeCategory({
            _id: 'c1',
            name: 'Cars',
            attributes: [
              {
                name: 'Make',
                key: 'make',
                type: 'select' as const,
                options: ['Toyota', 'Honda', 'BMW'],
                required: false,
              },
              {
                name: 'Mileage',
                key: 'mileage',
                type: 'range' as const,
                rangeMin: 0,
                rangeMax: 500000,
                required: false,
              },
            ],
          }),
        ),
      ),
    };

    routerMock = { navigate: vi.fn() };

    queryParamSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ q: 'car' }));
    routeMock = { queryParamMap: queryParamSubject };

    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.query()).toBe('');
    expect(component.results()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(component.sortBy()).toBe('relevance');
    expect(component.filtersOpen()).toBe(true);
  });

  it('should load categories on init', () => {
    component.ngOnInit();
    expect(categoriesServiceMock.getAll).toHaveBeenCalled();
    expect(component.categories().length).toBe(2);
  });

  it('should parse query params and execute search on init', () => {
    component.ngOnInit();
    expect(component.query()).toBe('car');
    expect(searchServiceMock.search).toHaveBeenCalled();
    expect(component.results().length).toBe(2);
    expect(component.featuredAds().length).toBe(1);
    expect(component.totalResults()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should set loading to false on search error', () => {
    searchServiceMock.search = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.results()).toEqual([]);
    expect(component.featuredAds()).toEqual([]);
  });

  it('should handle sort change', () => {
    component.ngOnInit();
    component.onSortChange('price_asc');
    expect(component.sortBy()).toBe('price_asc');
    expect(routerMock.navigate).toHaveBeenCalled();
  });

  it('should handle category change and load category filters', () => {
    component.ngOnInit();
    component.onCategoryChange('c1');
    expect(component.selectedCategoryId()).toBe('c1');
    expect(categoriesServiceMock.getById).toHaveBeenCalledWith('c1');
  });

  it('should clear category filters when category is deselected', () => {
    component.ngOnInit();
    component.onCategoryChange('c1');
    component.onCategoryChange('');
    expect(component.selectedCategoryId()).toBe('');
    expect(component.categoryFilters()).toEqual([]);
    expect(component.selectedCategory()).toBeNull();
  });

  it('should handle condition change', () => {
    component.ngOnInit();
    component.onConditionChange('new');
    expect(component.selectedCondition()).toBe('new');
    expect(routerMock.navigate).toHaveBeenCalled();
  });

  it('should handle dynamic filter change', () => {
    component.ngOnInit();
    component.onDynamicFilterChange('make', 'Toyota');
    expect(component.filterValues()['make']).toBe('Toyota');
  });

  it('should remove dynamic filter when value is empty', () => {
    component.ngOnInit();
    component.onDynamicFilterChange('make', 'Toyota');
    component.onDynamicFilterChange('make', '');
    expect(component.filterValues()['make']).toBeUndefined();
  });

  it('should build active filters correctly', () => {
    component.ngOnInit();
    component.selectedCategoryId.set('c1');
    component.selectedCondition.set('used');
    component.minPrice.set(1000);
    component.maxPrice.set(50000);
    component.filterValues.set({ make: 'Toyota' });
    component.categoryFilters.set([
      { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda'], required: false },
    ]);

    const filters = component.buildActiveFilters();
    expect(filters.length).toBe(5);
    expect(filters.find((f) => f.key === 'category')?.displayValue).toBe('Cars');
    expect(filters.find((f) => f.key === 'condition')?.displayValue).toBe('Used');
    expect(filters.find((f) => f.key === 'minPrice')?.displayValue).toBe('Min: PKR 1000');
    expect(filters.find((f) => f.key === 'maxPrice')?.displayValue).toBe('Max: PKR 50000');
    expect(filters.find((f) => f.key === 'make')?.displayValue).toBe('Make: Toyota');
  });

  it('should remove a filter chip', () => {
    component.ngOnInit();
    component.selectedCondition.set('new');
    const filter: ActiveFilter = {
      key: 'condition',
      label: 'Condition',
      value: 'new',
      displayValue: 'New',
    };
    component.removeFilter(filter);
    expect(component.selectedCondition()).toBe('');
  });

  it('should remove category filter chip', () => {
    component.ngOnInit();
    component.selectedCategoryId.set('c1');
    const filter: ActiveFilter = {
      key: 'category',
      label: 'Category',
      value: 'c1',
      displayValue: 'Cars',
    };
    component.removeFilter(filter);
    expect(component.selectedCategoryId()).toBe('');
  });

  it('should remove price filter chips', () => {
    component.ngOnInit();
    component.minPrice.set(500);
    component.maxPrice.set(10000);
    component.removeFilter({
      key: 'minPrice',
      label: 'Min Price',
      value: '500',
      displayValue: 'Min: PKR 500',
    });
    expect(component.minPrice()).toBeNull();
    component.removeFilter({
      key: 'maxPrice',
      label: 'Max Price',
      value: '10000',
      displayValue: 'Max: PKR 10000',
    });
    expect(component.maxPrice()).toBeNull();
  });

  it('should clear all filters', () => {
    component.ngOnInit();
    component.selectedCategoryId.set('c1');
    component.selectedCondition.set('used');
    component.minPrice.set(1000);
    component.maxPrice.set(50000);
    component.filterValues.set({ make: 'Toyota' });

    component.clearAllFilters();

    expect(component.selectedCategoryId()).toBe('');
    expect(component.selectedCondition()).toBe('');
    expect(component.minPrice()).toBeNull();
    expect(component.maxPrice()).toBeNull();
    expect(component.filterValues()).toEqual({});
  });

  it('should toggle filters panel', () => {
    expect(component.filtersOpen()).toBe(true);
    component.toggleFilters();
    expect(component.filtersOpen()).toBe(false);
    component.toggleFilters();
    expect(component.filtersOpen()).toBe(true);
  });

  it('should compute hasResults correctly', () => {
    expect(component.hasResults()).toBe(false);
    component.results.set([makeListing()]);
    expect(component.hasResults()).toBe(true);
  });

  it('should compute totalPages correctly', () => {
    component.totalResults.set(45);
    expect(component.totalPages()).toBe(3); // 45 / 20 = 2.25 → ceil = 3
  });

  it('should handle page navigation', () => {
    component.ngOnInit();
    component.totalResults.set(60);
    component.loadPage(2);
    expect(component.currentPage()).toBe(2);
    expect(routerMock.navigate).toHaveBeenCalled();
  });

  it('should not navigate to invalid pages', () => {
    component.ngOnInit();
    component.totalResults.set(20);
    const callCount = routerMock.navigate.mock.calls.length;
    component.loadPage(0);
    component.loadPage(2); // only 1 page
    expect(routerMock.navigate.mock.calls.length).toBe(callCount);
  });

  it('should return listing image correctly', () => {
    const listing = makeListing();
    expect(component.getListingImage(listing)).toBe('https://img.test/1_thumb.jpg');
  });

  it('should return placeholder for listing with no images', () => {
    const listing = makeListing({ images: [] });
    expect(component.getListingImage(listing)).toBe('assets/placeholder.png');
  });

  it('should handle search submit', () => {
    component.ngOnInit();
    component.searchInput.set('laptop');
    component.onSearchSubmit();
    expect(component.query()).toBe('laptop');
    expect(component.showSuggestions()).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalled();
  });

  it('should select a suggestion', () => {
    component.ngOnInit();
    component.selectSuggestion('iphone 15');
    expect(component.query()).toBe('iphone 15');
    expect(component.searchInput()).toBe('iphone 15');
    expect(component.showSuggestions()).toBe(false);
  });

  it('should have correct sort options', () => {
    expect(component.sortOptions.length).toBe(4);
    expect(component.sortOptions.map((o) => o.value)).toEqual([
      'relevance',
      'price_asc',
      'price_desc',
      'newest',
    ]);
  });

  it('should parse category from query params and load filters', () => {
    queryParamSubject = new BehaviorSubject<ParamMap>(
      convertToParamMap({ q: 'car', category: 'c1' }),
    );
    routeMock = { queryParamMap: queryParamSubject };
    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();
    expect(component.selectedCategoryId()).toBe('c1');
    expect(categoriesServiceMock.getById).toHaveBeenCalledWith('c1');
  });

  it('should parse sort and price from query params', () => {
    queryParamSubject = new BehaviorSubject<ParamMap>(
      convertToParamMap({ q: 'phone', sort: 'price_desc', minPrice: '500', maxPrice: '10000' }),
    );
    routeMock = { queryParamMap: queryParamSubject };
    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();
    expect(component.sortBy()).toBe('price_desc');
    expect(component.minPrice()).toBe(500);
    expect(component.maxPrice()).toBe(10000);
  });

  it('should handle no results with suggestions and related categories', () => {
    const emptyResponse: SearchResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      featuredAds: [],
      suggestions: ['mobile phone', 'smartphone'],
      relatedCategories: [{ _id: 'c2', name: 'Phones', slug: 'phones' }],
    };
    searchServiceMock.search = vi.fn().mockReturnValue(of(emptyResponse));

    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();

    expect(component.hasResults()).toBe(false);
    expect(component.suggestedTerms()).toEqual(['mobile phone', 'smartphone']);
    expect(component.relatedCategories().length).toBe(1);
    expect(component.relatedCategories()[0].name).toBe('Phones');
  });

  it('should set empty categories on categories load error', () => {
    categoriesServiceMock.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();
    expect(component.categories()).toEqual([]);
  });

  it('should handle category filter load error', () => {
    categoriesServiceMock.getById = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new SearchResultsComponent(
      routeMock as any,
      routerMock as any,
      searchServiceMock as unknown as SearchService,
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();
    component.onCategoryChange('c1');
    expect(component.categoryFilters()).toEqual([]);
    expect(component.selectedCategory()).toBeNull();
  });

  it('should clean up on destroy', () => {
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
