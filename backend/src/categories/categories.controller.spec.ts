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
    updateFeatures: jest.Mock;
    getInheritedAttributes: jest.Mock;
    getInheritedFeatures: jest.Mock;
    invalidateCache: jest.Mock;
  };

  const rootId = new Types.ObjectId().toString();
  const childId = new Types.ObjectId().toString();

  const mockTree: CategoryTreeNode[] = [
    {
      _id: rootId,
      name: 'Electronics',
      slug: 'electronics',
      icon: '',
      parentId: null,
      level: 1,
      isActive: true,
      hasBrands: false,
      sortOrder: 0,
      attributes: [],
      features: [],
      children: [
        {
          _id: childId,
          name: 'Mobile Phones',
          slug: 'mobile-phones',
          icon: '',
          parentId: rootId,
          level: 2,
          isActive: true,
          hasBrands: false,
          sortOrder: 0,
          attributes: [],
          features: [],
          children: [],
        },
      ],
    },
  ];

  const mockCategory = {
    _id: childId,
    name: 'Mobile Phones',
    slug: 'mobile-phones',
    icon: '',
    parentId: rootId,
    level: 2,
    attributes: [
      {
        name: 'Brand',
        key: 'brand',
        type: 'select',
        options: ['Apple', 'Samsung'],
        required: true,
      },
    ],
    features: ['Charger', 'Box'],
    isActive: true,
    hasBrands: false,
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
      updateFeatures: jest.fn().mockResolvedValue(mockCategory),
      getInheritedAttributes: jest.fn().mockResolvedValue([]),
      getInheritedFeatures: jest.fn().mockResolvedValue([]),
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
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a category with attributes and features', async () => {
      const result = await controller.getCategoryById(childId);
      expect(categoriesService.findById).toHaveBeenCalledWith(childId);
      expect(result).toEqual(mockCategory);
      expect(result.attributes).toHaveLength(1);
      expect(result.features).toHaveLength(2);
    });
  });

  describe('POST /api/categories', () => {
    it('should create a new category', async () => {
      const dto = { name: 'Vehicles', icon: 'car' };
      const result = await controller.createCategory(dto, 'admin-id', {});
      expect(categoriesService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('PATCH /api/categories/:id', () => {
    it('should update a category', async () => {
      const dto = { name: 'Updated Name' };
      const result = await controller.updateCategory(
        childId,
        dto,
        'admin-id',
        {},
      );
      expect(categoriesService.update).toHaveBeenCalledWith(childId, dto);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category', async () => {
      await controller.deleteCategory(childId, 'admin-id', {});
      expect(categoriesService.delete).toHaveBeenCalledWith(childId);
    });
  });

  describe('PATCH /api/categories/:id/attributes', () => {
    it('should update category attributes', async () => {
      const dto = {
        attributes: [
          {
            name: 'Storage',
            key: 'storage',
            type: 'select',
            options: ['64GB', '128GB'],
            required: false,
          },
        ],
      };
      const result = await controller.updateAttributes(
        childId,
        dto as any,
        'admin-id',
        {},
      );
      expect(categoriesService.updateAttributes).toHaveBeenCalledWith(
        childId,
        dto.attributes,
      );
    });
  });

  describe('PATCH /api/categories/:id/features', () => {
    it('should update category features', async () => {
      const dto = { features: ['ABS', 'Air Bags'] };
      const result = await controller.updateFeatures(
        childId,
        dto as any,
        'admin-id',
        {},
      );
      expect(categoriesService.updateFeatures).toHaveBeenCalledWith(
        childId,
        dto.features,
      );
    });
  });

  describe('Admin-only endpoint guards', () => {
    it('should have Roles("admin") on createCategory', () => {
      const roles = Reflect.getMetadata(
        'roles',
        CategoriesController.prototype.createCategory,
      );
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") on updateAttributes', () => {
      const roles = Reflect.getMetadata(
        'roles',
        CategoriesController.prototype.updateAttributes,
      );
      expect(roles).toEqual(['admin']);
    });

    it('should have Roles("admin") on updateFeatures', () => {
      const roles = Reflect.getMetadata(
        'roles',
        CategoriesController.prototype.updateFeatures,
      );
      expect(roles).toEqual(['admin']);
    });
  });
});
