import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { CategoryManagerComponent } from './category-manager.component';
import { CategoriesService } from '../../../core/services/categories.service';
import { AttributeDefinitionsService } from '../../../core/services/attribute-definitions.service';
import { Category, CategoryAttribute } from '../../../core/models';

const mockCategories: Category[] = [
  {
    _id: 'c1',
    name: 'Electronics',
    slug: 'electronics',
    level: 1,
    attributes: [
      {
        name: 'Brand',
        key: 'brand',
        type: 'select',
        options: ['Apple', 'Samsung'],
        required: true,
      },
    ],
    features: [],
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
    features: [],
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
    features: [],
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
    features: [],
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
    assignAttributes: vi.fn().mockReturnValue(of(mockCategories[0])),
    updateFeatures: vi.fn().mockReturnValue(of(mockCategories[0])),
    getInheritedAttributes: vi.fn().mockReturnValue(of({ attributes: [], features: [] })),
    invalidateCache: vi.fn(),
    buildBreadcrumb: vi.fn(),
  };
}

describe('CategoryManagerComponent', () => {
  let component: CategoryManagerComponent;
  let service: ReturnType<typeof createMockService>;
  let attrDefService: { getAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = createMockService();
    attrDefService = { getAll: vi.fn().mockReturnValue(of([])) };
    component = new CategoryManagerComponent(
      service as unknown as CategoriesService,
      attrDefService as unknown as AttributeDefinitionsService,
    );
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
      }),
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
      }),
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
    expect(service.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        name: 'Electronics Updated',
        slug: 'electronics-updated',
        isActive: true,
      }),
    );
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

  // --- ATTRIBUTES (registry-based) ---
  it('should open attributes panel and build assigned list from category', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    expect(component.activePanel).toBe('attributes');
    expect(component.assignedAttributes.length).toBe(1);
    expect(component.assignedAttributes[0].definition.name).toBe('Brand');
    expect(component.assignedAttributes[0].definition.key).toBe('brand');
    expect(component.assignedAttributes[0].options).toEqual(['Apple', 'Samsung']);
  });

  it('should add attribute via pickDefinition', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    const newDef = {
      _id: 'def2',
      name: 'Storage',
      key: 'storage',
      type: 'select',
      options: ['64GB', '128GB'],
    };
    component.pickDefinition(newDef as any);
    expect(component.assignedAttributes.length).toBe(2);
    expect(component.assignedAttributes[1].definition.name).toBe('Storage');
  });

  it('should remove assigned attribute by index', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    expect(component.assignedAttributes.length).toBe(1);
    component.removeAssigned(0);
    expect(component.assignedAttributes.length).toBe(0);
  });

  it('should save attributes using legacy endpoint when definitions have no IDs', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.saveAttributes();
    expect(service.updateAttributes).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should save attributes using assignAttributes when all have IDs', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.assignedAttributes[0].definition._id = 'def1';
    component.saveAttributes();
    expect(service.assignAttributes).toHaveBeenCalledWith(
      'c1',
      expect.arrayContaining([expect.objectContaining({ definitionId: 'def1' })]),
    );
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should handle save attributes error', () => {
    service.updateAttributes.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openAttributes(mockCategories[0]);
    component.saveAttributes();
    expect(component.saving()).toBe(false);
  });

  it('should handle categories with no attributes in open panel', () => {
    component.ngOnInit();
    component.openAttributes(mockCategories[1]);
    expect(component.assignedAttributes.length).toBe(0);
  });

  // --- FILTERS → FEATURES ---
  it('should open features panel with copies of existing features', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    expect(component.activePanel).toBe('features');
    expect(component.editingFeatures.length).toBe(0);
  });

  it('should add a new feature', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    component.newFeature = 'ABS';
    component.addFeature();
    expect(component.editingFeatures.length).toBe(1);
    expect(component.editingFeatures[0]).toBe('ABS');
  });

  it('should not add duplicate feature', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    component.newFeature = 'ABS';
    component.addFeature();
    component.newFeature = 'ABS';
    component.addFeature();
    expect(component.editingFeatures.length).toBe(1);
  });

  it('should remove a feature', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    component.newFeature = 'ABS';
    component.addFeature();
    component.removeFeature(0);
    expect(component.editingFeatures.length).toBe(0);
  });

  it('should save features', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    component.newFeature = 'ABS';
    component.addFeature();
    component.saveFeatures();
    expect(service.updateFeatures).toHaveBeenCalledWith('c1', ['ABS']);
    expect(component.saving()).toBe(false);
    expect(component.activePanel).toBe('none');
  });

  it('should handle save features error', () => {
    service.updateFeatures.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    component.openFeatures(mockCategories[0]);
    component.saveFeatures();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Failed to update features.');
  });

  // --- HELPERS ---
  it('should detect children correctly', () => {
    component.ngOnInit();
    expect(component.hasChildren(mockCategories[0])).toBe(true); // Electronics has Mobile Phones
    expect(component.hasChildren(mockCategories[1])).toBe(false); // Vehicles has no children
  });

  it('should handle categories with no features in open panel', () => {
    component.ngOnInit();
    component.openFeatures(mockCategories[1]);
    expect(component.editingFeatures.length).toBe(0);
  });
});
