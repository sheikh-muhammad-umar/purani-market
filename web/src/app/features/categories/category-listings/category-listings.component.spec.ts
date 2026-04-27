import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convertToParamMap, ParamMap } from '@angular/router';
import { CategoryListingsComponent } from './category-listings.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { ListingsService, ListingsResponse } from '../../../core/services/listings.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { Category, Listing } from '../../../core/models';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    _id: overrides._id ?? 'cat1',
    name: overrides.name ?? 'Cars',
    slug: overrides.slug ?? 'cars',
    parentId: overrides.parentId,
    level: overrides.level ?? 1,
    attributes: [],
    filters: [],
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

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

describe('CategoryListingsComponent', () => {
  let component: CategoryListingsComponent;
  let categoriesServiceMock: any;
  let listingsServiceMock: any;
  let paramMapSubject: BehaviorSubject<ParamMap>;
  let routeMock: any;
  let routerMock: any;

  const mockCategories: Category[] = [
    makeCategory({ _id: 'c1', name: 'Vehicles', slug: 'vehicles', sortOrder: 1 }),
    makeCategory({ _id: 'c2', name: 'Cars', slug: 'cars', parentId: 'c1', level: 2, sortOrder: 1 }),
    makeCategory({
      _id: 'c3',
      name: 'Bikes',
      slug: 'bikes',
      parentId: 'c1',
      level: 2,
      sortOrder: 2,
    }),
    makeCategory({
      _id: 'c4',
      name: 'Sedans',
      slug: 'sedans',
      parentId: 'c2',
      level: 3,
      sortOrder: 1,
    }),
    makeCategory({ _id: 'c5', name: 'Electronics', slug: 'electronics', sortOrder: 2 }),
  ];

  const mockListings: Listing[] = [
    makeListing({ _id: 'l1', title: 'Honda Civic 2020' }),
    makeListing({ _id: 'l2', title: 'Toyota Corolla 2019' }),
  ];

  const mockListingsResponse: ListingsResponse = {
    data: mockListings,
    total: 2,
    page: 1,
    limit: 20,
  };

  beforeEach(() => {
    paramMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ slug: 'vehicles' }));

    categoriesServiceMock = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
      getById: vi.fn(),
      getBySlug: vi.fn(),
      getChildren: vi.fn(),
      buildBreadcrumb: vi.fn((categories: Category[], targetId: string) => {
        const trail: Category[] = [];
        let current = categories.find((c: Category) => c._id === targetId);
        while (current) {
          trail.unshift(current);
          current = current.parentId
            ? categories.find((c: Category) => c._id === current!.parentId)
            : undefined;
        }
        return trail;
      }),
    };

    listingsServiceMock = {
      getByCategory: vi.fn().mockReturnValue(of(mockListingsResponse)),
      getFeatured: vi.fn(),
      getFeaturedFiltered: vi.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 10 })),
      getNearby: vi.fn(),
    };

    routeMock = { paramMap: paramMapSubject.asObservable() };
    routerMock = { navigate: vi.fn() };

    component = new CategoryListingsComponent(
      routeMock as any,
      routerMock as any,
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading states true initially', () => {
    expect(component.loadingCategory()).toBe(true);
    expect(component.loadingListings()).toBe(true);
  });

  it('should load category and listings on init', () => {
    component.ngOnInit();
    expect(categoriesServiceMock.getAll).toHaveBeenCalled();
    expect(component.currentCategory()?.name).toBe('Vehicles');
    expect(component.loadingCategory()).toBe(false);
    expect(listingsServiceMock.getByCategory).toHaveBeenCalledWith(
      'c1',
      1,
      20,
      undefined,
      undefined,
    );
    expect(component.listings().length).toBe(2);
    expect(component.loadingListings()).toBe(false);
  });

  it('should build breadcrumbs for top-level category', () => {
    component.ngOnInit();
    const crumbs = component.breadcrumbs();
    expect(crumbs.length).toBe(2);
    expect(crumbs[0].label).toBe('All Categories');
    expect(crumbs[0].slug).toBe('');
    expect(crumbs[1].label).toBe('Vehicles');
    expect(crumbs[1].isActive).toBe(true);
  });

  it('should build breadcrumbs for nested category', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'cars' }));
    component.ngOnInit();
    const crumbs = component.breadcrumbs();
    expect(crumbs.length).toBe(3);
    expect(crumbs[0].label).toBe('All Categories');
    expect(crumbs[1].label).toBe('Vehicles');
    expect(crumbs[1].isActive).toBe(false);
    expect(crumbs[2].label).toBe('Cars');
    expect(crumbs[2].isActive).toBe(true);
  });

  it('should build breadcrumbs for 3-level deep category', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'sedans' }));
    component.ngOnInit();
    const crumbs = component.breadcrumbs();
    expect(crumbs.length).toBe(4);
    expect(crumbs[0].label).toBe('All Categories');
    expect(crumbs[1].label).toBe('Vehicles');
    expect(crumbs[2].label).toBe('Cars');
    expect(crumbs[3].label).toBe('Sedans');
    expect(crumbs[3].isActive).toBe(true);
  });

  it('should display subcategories for parent category', () => {
    component.ngOnInit();
    expect(component.subcategories().length).toBe(2);
    expect(component.subcategories()[0].name).toBe('Cars');
    expect(component.subcategories()[1].name).toBe('Bikes');
  });

  it('should sort subcategories by sortOrder', () => {
    component.ngOnInit();
    const subs = component.subcategories();
    expect(subs[0].sortOrder).toBeLessThanOrEqual(subs[1].sortOrder);
  });

  it('should show no subcategories for leaf category', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'sedans' }));
    component.ngOnInit();
    expect(component.subcategories().length).toBe(0);
  });

  it('should handle category not found', () => {
    paramMapSubject.next(convertToParamMap({ slug: 'nonexistent' }));
    component.ngOnInit();
    expect(component.currentCategory()).toBeNull();
    expect(component.loadingCategory()).toBe(false);
    expect(component.loadingListings()).toBe(false);
  });

  it('should handle categories service error', () => {
    categoriesServiceMock.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new CategoryListingsComponent(
      routeMock as any,
      routerMock as any,
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
    component.ngOnInit();
    expect(component.loadingCategory()).toBe(false);
    expect(component.loadingListings()).toBe(false);
  });

  it('should handle listings service error', () => {
    listingsServiceMock.getByCategory = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('fail')));
    component = new CategoryListingsComponent(
      routeMock as any,
      routerMock as any,
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
    component.ngOnInit();
    expect(component.listings().length).toBe(0);
    expect(component.loadingListings()).toBe(false);
  });

  it('should return listing thumbnail image', () => {
    const listing = makeListing();
    expect(component.getListingImage(listing)).toBe('https://img.test/1_thumb.jpg');
  });

  it('should return fallback for listing with no images', () => {
    const listing = makeListing({ images: [] });
    expect(component.getListingImage(listing)).toBe('assets/placeholder.png');
  });

  it('should calculate total pages correctly', () => {
    listingsServiceMock.getByCategory = vi.fn().mockReturnValue(
      of({
        data: mockListings,
        total: 45,
        page: 1,
        limit: 20,
      }),
    );
    component = new CategoryListingsComponent(
      routeMock as any,
      routerMock as any,
      categoriesServiceMock as unknown as CategoriesService,
      listingsServiceMock as unknown as ListingsService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
    component.ngOnInit();
    expect(component.totalPages).toBe(3); // ceil(45/20)
  });

  it('should load next page when loadPage is called', () => {
    component.ngOnInit();
    listingsServiceMock.getByCategory.mockClear();
    component.loadPage(2);
    expect(component.currentPage()).toBe(2);
    expect(listingsServiceMock.getByCategory).toHaveBeenCalledWith(
      'c1',
      2,
      20,
      undefined,
      undefined,
    );
  });

  it('should react to route param changes', () => {
    component.ngOnInit();
    expect(component.currentCategory()?.slug).toBe('vehicles');

    paramMapSubject.next(convertToParamMap({ slug: 'electronics' }));
    expect(component.currentCategory()?.slug).toBe('electronics');
  });

  it('should clean up subscriptions on destroy', () => {
    component.ngOnInit();
    component.ngOnDestroy();
    // After destroy, route changes should not trigger loads
    categoriesServiceMock.getAll.mockClear();
    paramMapSubject.next(convertToParamMap({ slug: 'cars' }));
    expect(categoriesServiceMock.getAll).not.toHaveBeenCalled();
  });
});
