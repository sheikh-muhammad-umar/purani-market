import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService, CategoryTreeNode } from './categories.service';
import { Types } from 'mongoose';
import { Reflector } from '@nestjs/core';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: {
    getCategoryTree: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    updateAttributes: jest.Mock;
    updateFilters: jest.Mock;
    invalidateCache: jest.Mock;
  };

  const rootId = new Types.ObjectId().toString();
  const childId = new Types.ObjectId().toString();

  const mockTree: CategoryTreeNode[] = [
    {
      _id: rootId,
      name: 'Electronics',
      slug: 'electronics',
      parentId: null,
      level: 1,
      isActive: true,
      sortOrder: 0,
      children: [
        {
          _id: childId,
          name: 'Mobile Phones',
          slug: 'mobile-phones',
          parentId: rootId,
          level: 2,
          isActive: true,
          sortOrder: 0,
          children: [],
        },
      ],
    },
  ];

  const mockCategory = {
    _id: childId,
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    parentId: rootId,
    level: 2,
    attributes: [
      { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'], required: true },
    ],
    filters: [
      { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'] },
    ],
    isActive: true,
    sortOrder: 0,
  };

  beforeEach(async () => {
    categoriesService = {
      getCategoryTree: jest.fn().mockResolvedValue(mockTree),
      findById: jest.fn().mockResolvedValue(mockCategory),
      create: jest.fn().mockResolvedValue(mockCategory),
      update: jest.fn().mockResolvedValue(mockCategory),
      delete: jest.fn().mockResolvedValue(undefined),
      updateAttributes: jest.fn().mockResolvedValue(mockCategory),
      updateFilters: jest.fn().mockResolvedValue(mockCategory),
      invalidateCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: categoriesService },
        Reflector,
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  describe('GET /api/categories', () => {
    it('should return the full category tree', async () => {
      const result = await controller.getCategoryTree();

      expect(categoriesService.getCategoryTree).toHaveBeenCalled();
      expect(result).toEqual(mockTree);
      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a category with attributes and filters', async () => {
      const result = await controller.getCategoryById(childId);

      expect(categoriesService.findById).toHaveBeenCalledWith(childId);
      expect(result).toEqual(mockCategory);
      expect(result.attributes).toHaveLength(1);
      expect(result.filters).toHaveLength(1);
    });
  });

  describe('POST /api/categories', () => {
    it('should create a new category', async () => {
      const dto = { name: 'Vehicles' };
      const result = await controller.createCategory(dto);

      expect(categoriesService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('PATCH /api/categories/:id', () => {
    it('should update a category', async () => {
      const dto = { name: 'Updated Name' };
      const result = await controller.updateCategory(childId, dto);

      expect(categoriesService.update).toHaveBeenCalledWith(childId, dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category', async () => {
      await controller.deleteCategory(childId);

      expect(categoriesService.delete).toHaveBeenCalledWith(childId);
    });
  });

  describe('PATCH /api/categories/:id/attributes', () => {
    it('should update category attributes', async () => {
      const dto = {
        attributes: [
          { name: 'Storage', key: 'storage', type: 'select', options: ['64GB', '128GB'], required: false },
        ],
      };
      const result = await controller.updateAttributes(childId, dto as any);

      expect(categoriesService.updateAttributes).toHaveBeenCalledWith(childId, dto.attributes);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('PATCH /api/categories/:id/filters', () => {
    it('should update category filters', async () => {
      const dto = {
        filters: [
          { name: 'Price Range', key: 'price', type: 'range', rangeMin: 0, rangeMax: 100000 },
        ],
      };
      const result = await controller.updateFilters(childId, dto as any);

      expect(categoriesService.updateFilters).toHaveBeenCalledWith(childId, dto.filters);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('Admin-only endpoint guards', () => {
    it('should have UseGuards with JwtAuthGuard and RolesGuard on createCategory', () => {
      const guards = Reflect.getMetadata('__guards__', CategoriesController.prototype.createCategory);
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
    });

    it('should have Roles("admin") decorator on createCategory', () => {
      const roles = Reflect.getMetadata('roles', CategoriesController.prototype.createCategory);
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") decorator on updateCategory', () => {
      const roles = Reflect.getMetadata('roles', CategoriesController.prototype.updateCategory);
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") decorator on deleteCategory', () => {
      const roles = Reflect.getMetadata('roles', CategoriesController.prototype.deleteCategory);
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") decorator on updateAttributes', () => {
      const roles = Reflect.getMetadata('roles', CategoriesController.prototype.updateAttributes);
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") decorator on updateFilters', () => {
      const roles = Reflect.getMetadata('roles', CategoriesController.prototype.updateFilters);
      expect(roles).toEqual(['admin']);
    });
  });
});
