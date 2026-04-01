import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryBrowseComponent } from './category-browse.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models';

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

describe('CategoryBrowseComponent', () => {
  let component: CategoryBrowseComponent;
  let categoriesServiceMock: { getAll: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };

  const mockCategories: Category[] = [
    makeCategory({ _id: 'c1', name: 'Cars', slug: 'cars', sortOrder: 2 }),
    makeCategory({ _id: 'c2', name: 'Phones', slug: 'phones', sortOrder: 1 }),
    makeCategory({ _id: 'c3', name: 'Property', slug: 'property', sortOrder: 3 }),
    makeCategory({ _id: 'c4', name: 'Inactive', slug: 'inactive', isActive: false, sortOrder: 4 }),
    makeCategory({ _id: 'c5', name: 'Sedans', slug: 'sedans', level: 2, parentId: 'c1', sortOrder: 1 }),
    makeCategory({ _id: 'c6', name: 'SUVs', slug: 'suvs', level: 2, parentId: 'c1', sortOrder: 2 }),
  ];

  beforeEach(() => {
    categoriesServiceMock = {
      getAll: vi.fn().mockReturnValue(of(mockCategories)),
      getById: vi.fn(),
    };

    component = new CategoryBrowseComponent(
      categoriesServiceMock as unknown as CategoriesService,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading true initially', () => {
    expect(component.loading()).toBe(true);
  });

  it('should load categories on init and filter to active level-1 only', () => {
    component.ngOnInit();
    const topLevel = component.topLevelCategories();
    expect(topLevel.length).toBe(3);
    expect(topLevel.map(c => c.name)).toEqual(['Phones', 'Cars', 'Property']);
  });

  it('should sort top-level categories by sortOrder', () => {
    component.ngOnInit();
    const topLevel = component.topLevelCategories();
    expect(topLevel[0].name).toBe('Phones');
    expect(topLevel[1].name).toBe('Cars');
    expect(topLevel[2].name).toBe('Property');
  });

  it('should exclude inactive categories', () => {
    component.ngOnInit();
    const names = component.topLevelCategories().map(c => c.name);
    expect(names).not.toContain('Inactive');
  });

  it('should exclude non-level-1 categories', () => {
    component.ngOnInit();
    const names = component.topLevelCategories().map(c => c.name);
    expect(names).not.toContain('Sedans');
    expect(names).not.toContain('SUVs');
  });

  it('should set loading to false after categories load', () => {
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('should set loading to false on error', () => {
    categoriesServiceMock.getAll = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new CategoryBrowseComponent(
      categoriesServiceMock as unknown as CategoriesService,
    );
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.topLevelCategories().length).toBe(0);
  });

  it('should return correct category image for known slugs', () => {
    expect(component.getCategoryImage('cars', 'Cars')).toContain('cars');
    expect(component.getCategoryImage('phones', 'Phones')).toContain('phones');
    expect(component.getCategoryImage('property', 'Property')).toContain('property');
  });

  it('should return default image for unknown categories', () => {
    expect(component.getCategoryImage('unknown', 'Unknown')).toBe('assets/categories/default.jpg');
  });

  it('should return correct icon for known categories', () => {
    expect(component.getCategoryIcon('cars', 'Cars')).toBe('🚗');
    expect(component.getCategoryIcon('phones', 'Phones')).toBe('📱');
    expect(component.getCategoryIcon('property', 'Property')).toBe('🏠');
  });

  it('should return default icon for unknown categories', () => {
    expect(component.getCategoryIcon('unknown', 'Unknown')).toBe('📦');
  });

  it('should count subcategories correctly', () => {
    component.ngOnInit();
    expect(component.getSubcategoryCount('c1')).toBe(2); // Sedans + SUVs
    expect(component.getSubcategoryCount('c2')).toBe(0); // No children
    expect(component.getSubcategoryCount('c3')).toBe(0);
  });
});
