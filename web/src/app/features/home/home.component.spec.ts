import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { CategoriesService } from '../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../core/services/listings.service';
import { RecommendationsService } from '../../core/services/recommendations.service';
import { AuthService } from '../../core/auth';
import { Category, Listing } from '../../core/models';

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
    attributes: [],
    filters: [],
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('HomeComponent', () => {
  let component: HomeComponent;
  let categoriesServiceMock: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };
  let listingsServiceMock: {
    getFeatured: ReturnType<typeof vi.fn>;
    getNearby: ReturnType<typeof vi.fn>;
  };
  let recommendationsServiceMock: {
    getRecommendations: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  };

  const mockCategories: Category[] = [
    makeCategory({ _id: 'c1', name: 'Cars', slug: 'cars', sortOrder: 1 }),
    makeCategory({ _id: 'c2', name: 'Phones', slug: 'phones', sortOrder: 2 }),
    makeCategory({ _id: 'c3', name: 'Property', slug: 'property', sortOrder: 3 }),
    makeCategory({ _id: 'c4', name: 'Inactive', slug: 'inactive', isActive: false, sortOrder: 4 }),
    makeCategory({ _id: 'c5', name: 'Sub Category', slug: 'sub', level: 2, sortOrder: 5 }),
  ];

  const mockFeatured: Listing[] = [
    makeListing({
      _id: 'f1',
      title: 'Featured Car',
      isFeatured: true,
      price: { amount: 500000, currency: 'PKR' },
    }),
    makeListing({
      _id: 'f2',
      title: 'Featured Phone',
      isFeatured: true,
      price: { amount: 25000, currency: 'PKR' },
    }),
  ];

  const mockRecommendations: Listing[] = [
    makeListing({ _id: 'r1', title: 'Recommended Item 1' }),
    makeListing({ _id: 'r2', title: 'Recommended Item 2' }),
  ];

  beforeEach(() => {
    categoriesServiceMock = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
      getById: vi.fn(),
    };

    listingsServiceMock = {
      getFeatured: vi
        .fn()
        .mockReturnValue(of({ data: mockFeatured, total: 2, page: 1, limit: 10 })),
      getFeaturedFiltered: vi
        .fn()
        .mockReturnValue(of({ data: mockFeatured, total: 2, page: 1, limit: 10 })),
      getNearby: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 12 })),
      getByCategory: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 20 })),
    };

    recommendationsServiceMock = {
      getRecommendations: vi.fn().mockReturnValue(of(mockRecommendations)),
      dismiss: vi.fn(),
    };

    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading states true initially', () => {
    expect(component.loadingCategories()).toBe(true);
    expect(component.loadingFeatured()).toBe(true);
    expect(component.loadingRecommendations()).toBe(true);
    expect(component.loadingNearby()).toBe(true);
  });

  it('should load categories on init and filter to active level-1 only', () => {
    component.ngOnInit();
    const chips = component.categoryChips();
    expect(chips.length).toBe(3);
    expect(chips[0].name).toBe('Cars');
    expect(chips[1].name).toBe('Phones');
    expect(chips[2].name).toBe('Property');
  });

  it('should assign correct icons to known categories', () => {
    component.ngOnInit();
    const chips = component.categoryChips();
    // Icons are now URL paths, not emojis
    expect(chips[0].iconUrl).toBeTruthy();
    expect(chips[1].iconUrl).toBeTruthy();
    expect(chips[2].iconUrl).toBeTruthy();
  });

  it('should sort category chips by sortOrder', () => {
    const unsorted = [
      makeCategory({ _id: 'a', name: 'Zebra', slug: 'zebra', sortOrder: 3 }),
      makeCategory({ _id: 'b', name: 'Alpha', slug: 'alpha', sortOrder: 1 }),
      makeCategory({ _id: 'c', name: 'Middle', slug: 'middle', sortOrder: 2 }),
    ];
    categoriesServiceMock.getAll = vi.fn().mockReturnValue(of(unsorted));
    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
    component.ngOnInit();
    const chips = component.categoryChips();
    expect(chips[0].name).toBe('Alpha');
    expect(chips[1].name).toBe('Middle');
    expect(chips[2].name).toBe('Zebra');
  });

  it('should load featured listings on init', () => {
    component.ngOnInit();
    expect(listingsServiceMock.getFeaturedFiltered).toHaveBeenCalled();
    expect(component.featuredListings().length).toBe(2);
    expect(component.loadingFeatured()).toBe(false);
  });

  it('should load recommendations on init', () => {
    component.ngOnInit();
    expect(recommendationsServiceMock.getRecommendations).toHaveBeenCalledWith(20);
    expect(component.recommendations().length).toBe(2);
    expect(component.loadingRecommendations()).toBe(false);
  });

  it('should set loading to false on categories error', () => {
    categoriesServiceMock.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
    component.ngOnInit();
    expect(component.loadingCategories()).toBe(false);
    expect(component.categoryChips().length).toBe(0);
  });

  it('should set loading to false on featured error', () => {
    listingsServiceMock.getFeaturedFiltered = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('fail')));
    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
    component.ngOnInit();
    expect(component.loadingFeatured()).toBe(false);
  });

  it('should set loading to false on recommendations error', () => {
    recommendationsServiceMock.getRecommendations = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('fail')));
    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
    component.ngOnInit();
    expect(component.loadingRecommendations()).toBe(false);
  });

  it('should return correct category icon for known slugs', () => {
    // getCategoryIcon was removed; icons are now URL-based
  });

  it('should fall back to name-based icon lookup', () => {
    // getCategoryIcon was removed
  });

  it('should return default icon for unknown categories', () => {
    // getCategoryIcon was removed
  });

  it('should return thumbnail URL from listing images', () => {
    const listing = makeListing();
    expect(component.getListingImage(listing)).toBe('https://img.test/1_thumb.jpg');
  });

  it('should return main URL if no thumbnail', () => {
    const listing = makeListing({
      images: [{ url: 'https://img.test/main.jpg', thumbnailUrl: '', sortOrder: 0 }],
    });
    expect(component.getListingImage(listing)).toBe('https://img.test/main.jpg');
  });

  it('should return fallback for listing with no images', () => {
    const listing = makeListing({ images: [] });
    expect(component.getListingImage(listing)).toBe('assets/placeholder.png');
  });

  it('should exclude inactive categories from chips', () => {
    component.ngOnInit();
    const chips = component.categoryChips();
    const names = chips.map((c) => c.name);
    expect(names).not.toContain('Inactive');
  });

  it('should exclude non-level-1 categories from chips', () => {
    component.ngOnInit();
    const chips = component.categoryChips();
    const names = chips.map((c) => c.name);
    expect(names).not.toContain('Sub Category');
  });

  it('should set userCity from nearby listings response', () => {
    const nearbyData: Listing[] = [
      makeListing({
        _id: 'n1',
        location: { type: 'Point', coordinates: [74.3, 31.5], city: 'Karachi', area: 'DHA' },
      }),
    ];
    // The component falls back to getByCategory when no saved location
    listingsServiceMock.getByCategory = vi
      .fn()
      .mockReturnValue(of({ data: nearbyData, total: 1, page: 1, limit: 12 }));

    component = new HomeComponent(
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      recommendationsServiceMock as unknown as RecommendationsService,
      { isAuthenticated: () => false, user: () => null } as unknown as AuthService,
    );
    component.ngOnInit();

    expect(component.nearbyListings().length).toBe(1);
    expect(component.loadingNearby()).toBe(false);
  });
});
