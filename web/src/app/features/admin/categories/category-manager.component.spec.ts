import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { CategoryManagerComponent } from './category-manager.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category, CategoryAttribute, CategoryFilter } from '../../../core/models';

const mockCategories: Category[] = [
  {
    _id: 'c1',
    name: 'Electronics',
    slug: 'electronics',
    level: 1,
    attributes: [{ name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'], required: true }],
    filters: [{ name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'] }],
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'c2',
    name: 'Vehicles',
    slug: 'vehicles',
    level: 1,
    attributes: [],
    filters: [],
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'c3',
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    parentId: 'c1',
    level: 2,
    attributes: [],
    filters: [],
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'c4',
    name: 'Smartphones',
    slug: 'smartphones',
    parentId: 'c3',
    level: 3,
    attributes: [],
    filters: [],
    isActive: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function createMockService() {
  return {
    getAll: vi.fn().mockReturnValue(of(mockCategories)),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getChildren: vi.fn(),
    create: vi.fn().mockReturnValue(of(mockCategories[0])),
    update: vi.fn().mockReturnValue(of(mockCategories[0])),
    remove: vi.fn().mockReturnValue(of(undefined)),
    updateAttributes: vi.fn().mockReturnValue(of(mockCategories[0])),
    updateFilters: vi.fn().mockReturnValue(of(mockCategories[0])),
    buildBreadcrumb: vi.fn(),
  };
}

describe('CategoryManagerComponent', () => {
  let component: CategoryManagerComponent;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    component = new CategoryManagerComponent(service as unknown as CategoriesService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Loading ---
  it('should load categories on init and build tree', () => {
    component.ngOnInit();
    expect(service.getAll).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.flatCategories().length).toBe(4);
    const tree = component.tree();
    expect(tree.length).toBe(2); // 2 root categories
    expect(tree[0].category.name).toBe('Electronics');
    expect(tree[1].category.name).toBe('Vehicles');
  });

  it('should build nested tree nodes', () => {
    component.ngOnInit();
    const electronics = component.tree()[0];
    expect(electronics.children.length).toBe(1);
    expect(electronics.children[0].category.name).toBe('Mobile Phones');
    expect(electronics.children[0].children.length).toBe(1);
    expect(electronics.children[0].children[0].category.name).toBe('Smartphones');
  });

  it('should handle load error', () => {
    service.getAll.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Failed to load categories. Please try again.');
  });

  // --- Tree interactions ---
  it('should toggle expand on a node', () => {
    component.ngOnInit();
    const node = component.tree()[0];
    expect(node.expanded).toBe(false);
    component.toggleExpand(node);
    expect(node.expanded).toBe(true);
    component.toggleExpand(node);
    expect(node.expanded).toBe(false);
  });

  it('should select a category', () => {
    component.ngOnInit();
    const cat = mockCategories[0];
    component.selectCategory(cat);
    expect(component.selectedCategory()).toBe(cat);
    expect(component.activePanel).toBe('none');
  });

  // --- ADD ---
  it('should open add form with defaults', () => {
    component.openAddForm();
    expect(component.activePanel).toBe('add');
    expect(component.formName).toBe('');
    expect(component.formSlug).toBe('');
    expect(component.formParentId).toBe('');
    expect(component.formIsActive).toBe(true);
  });

  it('should open add form with parent id', () => {
    component.openAddForm('c1');
    expect(component.formParentId).toBe('c1');
  });

  it('should generate slug from name', () => {
    component.formName = 'My New Category';
    component.generateSlug();
    expect(component.formSlug).toBe('my-new-category');
  });

  it('should submit add and reload', () => {
    component.ngOnInit();
    component.openAddForm();
    component.formName = 'Fashion';
    component.formSlug = 'fashion';
    component.submitAdd();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Fashion',
        slug: 'fashion',
        level: 1,
        isActive: true,
      })
    );
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should submit add with parent', () => {
    component.ngOnInit();
    component.openAddForm('c1');
    component.formName = 'Laptops';
    component.formSlug = 'laptops';
    component.formParentId = 'c1';
    component.submitAdd();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Laptops',
        slug: 'laptops',
        level: 2,
        parentId: 'c1',
      })
    );
  });

  it('should not submit add with empty name', () => {
    component.ngOnInit();
    component.openAddForm();
    component.formName = '';
    component.formSlug = 'test';
    component.submitAdd();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('should not submit add with empty slug', () => {
    component.ngOnInit();
    component.openAddForm();
    component.formName = 'Test';
    component.formSlug = '';
    component.submitAdd();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('should not allow adding level > 3', () => {
    component.ngOnInit();
    component.openAddForm('c4'); // c4 is level 3
    component.formName = 'Deep';
    component.formSlug = 'deep';
    component.formParentId = 'c4';
    component.submitAdd();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('should handle add error', () => {
    service.create.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openAddForm();
    component.formName = 'Test';
    component.formSlug = 'test';
    component.submitAdd();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to create category.');
  });

  // --- EDIT ---
  it('should open edit form with category data', () => {
    component.ngOnInit();
    const cat = mockCategories[0];
    component.openEditForm(cat);
    expect(component.activePanel).toBe('edit');
    expect(component.formName).toBe('Electronics');
    expect(component.formSlug).toBe('electronics');
    expect(component.formIsActive).toBe(true);
    expect(component.selectedCategory()).toBe(cat);
  });

  it('should submit edit and reload', () => {
    component.ngOnInit();
    component.openEditForm(mockCategories[0]);
    component.formName = 'Electronics Updated';
    component.formSlug = 'electronics-updated';
    component.submitEdit();
    expect(service.update).toHaveBeenCalledWith('c1', {
      name: 'Electronics Updated',
      slug: 'electronics-updated',
      isActive: true,
    });
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should not submit edit with empty name', () => {
    component.ngOnInit();
    component.openEditForm(mockCategories[0]);
    component.formName = '';
    component.submitEdit();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('should handle edit error', () => {
    service.update.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openEditForm(mockCategories[0]);
    component.formName = 'Updated';
    component.formSlug = 'updated';
    component.submitEdit();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to update category.');
  });

  // --- DELETE ---
  it('should delete category and reload', () => {
    component.ngOnInit();
    component.selectCategory(mockCategories[1]); // Vehicles (no children)
    component.deleteCategory(mockCategories[1]);
    expect(service.remove).toHaveBeenCalledWith('c2');
    expect(component.saving()).toBe(false);
  });

  it('should clear selection when deleting selected category', () => {
    component.ngOnInit();
    component.selectCategory(mockCategories[1]);
    component.deleteCategory(mockCategories[1]);
    expect(component.selectedCategory()).toBeNull();
    expect(component.activePanel).toBe('none');
  });

  it('should handle delete error', () => {
    service.remove.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.deleteCategory(mockCategories[1]);
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to delete category.');
  });

  // --- REORDER ---
  it('should move a node up by swapping sort orders', () => {
    component.ngOnInit();
    const siblings = component.tree();
    const vehiclesNode = siblings[1]; // sortOrder 1
    component.moveUp(vehiclesNode, siblings);
    expect(service.update).toHaveBeenCalledWith('c1', { sortOrder: 1 });
    expect(service.update).toHaveBeenCalledWith('c2', { sortOrder: 0 });
  });

  it('should move a node down by swapping sort orders', () => {
    component.ngOnInit();
    const siblings = component.tree();
    const electronicsNode = siblings[0]; // sortOrder 0
    component.moveDown(electronicsNode, siblings);
    expect(service.update).toHaveBeenCalledWith('c1', { sortOrder: 1 });
    expect(service.update).toHaveBeenCalledWith('c2', { sortOrder: 0 });
  });

  it('should not move first node up', () => {
    component.ngOnInit();
    const siblings = component.tree();
    component.moveUp(siblings[0], siblings);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('should not move last node down', () => {
    component.ngOnInit();
    const siblings = component.tree();
    component.moveDown(siblings[siblings.length - 1], siblings);
    expect(service.update).not.toHaveBeenCalled();
  });

  // --- ATTRIBUTES ---
  it('should open attributes panel with copies of existing attributes', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    expect(component.activePanel).toBe('attributes');
    expect(component.editingAttributes.length).toBe(1);
    expect(component.editingAttributes[0].name).toBe('Brand');
    // Verify it's a copy, not the same reference
    expect(component.editingAttributes[0]).not.toBe(mockCategories[0].attributes[0]);
    expect(component.editingAttributes[0].options).not.toBe(mockCategories[0].attributes[0].options);
  });

  it('should add a new attribute', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.addAttribute();
    expect(component.editingAttributes.length).toBe(2);
    expect(component.editingAttributes[1].name).toBe('');
    expect(component.editingAttributes[1].type).toBe('text');
  });

  it('should remove an attribute', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.removeAttribute(0);
    expect(component.editingAttributes.length).toBe(0);
  });

  it('should generate attribute key from name', () => {
    const attr: CategoryAttribute = { name: 'Body Type', key: '', type: 'text', required: false };
    component.generateAttributeKey(attr);
    expect(attr.key).toBe('body_type');
  });

  it('should add and remove attribute options', () => {
    const attr: CategoryAttribute = { name: 'Color', key: 'color', type: 'select', required: false, options: ['Red'] };
    component.addAttributeOption(attr);
    expect(attr.options!.length).toBe(2);
    component.removeAttributeOption(attr, 0);
    expect(attr.options!.length).toBe(1);
    expect(attr.options![0]).toBe('');
  });

  it('should save attributes', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.saveAttributes();
    expect(service.updateAttributes).toHaveBeenCalledWith('c1', component.editingAttributes);
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should not save attributes with empty name', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.editingAttributes[0].name = '';
    component.saveAttributes();
    expect(service.updateAttributes).not.toHaveBeenCalled();
  });

  it('should not save attributes with empty key', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.editingAttributes[0].key = '';
    component.saveAttributes();
    expect(service.updateAttributes).not.toHaveBeenCalled();
  });

  it('should handle save attributes error', () => {
    service.updateAttributes.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.saveAttributes();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to update attributes.');
  });

  // --- FILTERS ---
  it('should open filters panel with copies of existing filters', () => {
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    expect(component.activePanel).toBe('filters');
    expect(component.editingFilters.length).toBe(1);
    expect(component.editingFilters[0].name).toBe('Brand');
    expect(component.editingFilters[0]).not.toBe(mockCategories[0].filters[0]);
  });

  it('should add a new filter', () => {
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    component.addFilter();
    expect(component.editingFilters.length).toBe(2);
    expect(component.editingFilters[1].type).toBe('select');
  });

  it('should remove a filter', () => {
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    component.removeFilter(0);
    expect(component.editingFilters.length).toBe(0);
  });

  it('should generate filter key from name', () => {
    const filter: CategoryFilter = { name: 'Price Range', key: '', type: 'range' };
    component.generateFilterKey(filter);
    expect(filter.key).toBe('price_range');
  });

  it('should add and remove filter options', () => {
    const filter: CategoryFilter = { name: 'Brand', key: 'brand', type: 'select', options: ['Toyota'] };
    component.addFilterOption(filter);
    expect(filter.options!.length).toBe(2);
    component.removeFilterOption(filter, 0);
    expect(filter.options!.length).toBe(1);
  });

  it('should save filters', () => {
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    component.saveFilters();
    expect(service.updateFilters).toHaveBeenCalledWith('c1', component.editingFilters);
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should not save filters with empty name', () => {
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    component.editingFilters[0].name = '';
    component.saveFilters();
    expect(service.updateFilters).not.toHaveBeenCalled();
  });

  it('should handle save filters error', () => {
    service.updateFilters.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openFilters(mockCategories[0]);
    component.saveFilters();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to update filters.');
  });

  // --- HELPERS ---
  it('should detect children correctly', () => {
    component.ngOnInit();
    expect(component.hasChildren(mockCategories[0])).toBe(true); // Electronics has Mobile Phones
    expect(component.hasChildren(mockCategories[1])).toBe(false); // Vehicles has no children
  });

  it('should handle categories with no attributes/filters in open panels', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[1]); // Vehicles has empty attributes
    expect(component.editingAttributes.length).toBe(0);
    component.openFilters(mockCategories[1]);
    expect(component.editingFilters.length).toBe(0);
  });

  it('trackByIndex should return the index', () => {
    expect(component.trackByIndex(5)).toBe(5);
  });
});
