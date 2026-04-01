import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './schemas/category.schema';
import { Types } from 'mongoose';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockCategoryModel: any;
  let mockRedis: Record<string, jest.Mock>;

  const rootId = new Types.ObjectId();
  const childId = new Types.ObjectId();
  const grandchildId = new Types.ObjectId();

  const mockCategories = [
    {
      _id: rootId,
      name: 'Electronics',
      slug: 'electronics',
      parentId: null,
      level: 1,
      isActive: true,
      sortOrder: 0,
      attributes: [],
      filters: [],
    },
    {
      _id: childId,
      name: 'Mobile Phones',
      slug: 'mobile-phones',
      parentId: rootId,
      level: 2,
      isActive: true,
      sortOrder: 0,
      attributes: [{ name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'], required: true }],
      filters: [{ name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung'] }],
    },
    {
      _id: grandchildId,
      name: 'Smartphones',
      slug: 'smartphones',
      parentId: childId,
      level: 3,
      isActive: true,
      sortOrder: 0,
      attributes: [],
      filters: [],
    },
  ];

  beforeEach(async () => {
    mockCategoryModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), ...data }),
    }));

    mockCategoryModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockCategories),
        }),
      }),
      exec: jest.fn().mockResolvedValue([]),
    });

    mockCategoryModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockCategories[1]),
    });

    mockCategoryModel.deleteOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('getCategoryTree', () => {
    it('should return cached tree when available', async () => {
      const cachedTree = [{ _id: rootId.toString(), name: 'Electronics', children: [] }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedTree));

      const result = await service.getCategoryTree();

      expect(result).toEqual(cachedTree);
      expect(mockCategoryModel.find).not.toHaveBeenCalled();
    });

    it('should build tree from database when cache is empty', async () => {
      const result = await service.getCategoryTree();

      expect(mockCategoryModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Electronics');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Mobile Phones');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('Smartphones');
    });

    it('should cache the tree after building from database', async () => {
      await service.getCategoryTree();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'categories:tree',
        expect.any(String),
        'EX',
        3600,
      );
    });
  });

  describe('findById', () => {
    it('should return a category by id', async () => {
      const result = await service.findById(childId.toString());

      expect(mockCategoryModel.findById).toHaveBeenCalledWith(childId.toString());
      expect(result).toBe(mockCategories[1]);
    });

    it('should throw NotFoundException for invalid ObjectId', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });
  });

  describe('invalidateCache', () => {
    it('should delete the category tree cache key', async () => {
      await service.invalidateCache();

      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });
  });

  describe('create', () => {
    it('should create a root category with level 1', async () => {
      const dto = { name: 'Vehicles' };
      const result = await service.create(dto);

      expect(result.name).toBe('Vehicles');
      expect(result.slug).toBe('vehicles');
      expect(result.level).toBe(1);
      expect(result.parentId).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should create a child category with parent level + 1', async () => {
      // Mock findById to return a level-1 parent
      const parentDoc = {
        _id: rootId,
        name: 'Electronics',
        level: 1,
        parentId: null,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(parentDoc),
      });

      const dto = { name: 'Laptops', parentId: rootId.toString() };
      const result = await service.create(dto);

      expect(result.name).toBe('Laptops');
      expect(result.level).toBe(2);
      expect(result.parentId).toBe(rootId.toString());
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should create a grandchild category at level 3', async () => {
      const level2Doc = {
        _id: childId,
        name: 'Mobile Phones',
        level: 2,
        parentId: rootId,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(level2Doc),
      });

      const dto = { name: 'Smartphones', parentId: childId.toString() };
      const result = await service.create(dto);

      expect(result.name).toBe('Smartphones');
      expect(result.level).toBe(3);
      expect(result.parentId).toBe(childId.toString());
    });

    it('should reject creating a child under a level-3 category', async () => {
      const level3Doc = {
        _id: grandchildId,
        name: 'Smartphones',
        level: 3,
        parentId: childId,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(level3Doc),
      });

      const dto = { name: 'Budget Phones', parentId: grandchildId.toString() };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should auto-generate slug from name', async () => {
      const dto = { name: 'Home & Garden' };
      const result = await service.create(dto);

      expect(result.slug).toBe('home-garden');
    });

    it('should use provided slug when given', async () => {
      const dto = { name: 'Home & Garden', slug: 'home-garden' };
      const result = await service.create(dto);

      expect(result.slug).toBe('home-garden');
    });
  });

  describe('update', () => {
    it('should update category fields and invalidate cache', async () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const categoryDoc = {
        _id: childId,
        name: 'Mobile Phones',
        slug: 'mobile-phones',
        isActive: true,
        sortOrder: 0,
        save: saveMock,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });

      const result = await service.update(childId.toString(), { name: 'Phones', sortOrder: 5 });

      expect(result.name).toBe('Phones');
      expect(result.sortOrder).toBe(5);
      expect(saveMock).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should throw NotFoundException for non-existent category', async () => {
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(new Types.ObjectId().toString(), { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a category with no children and invalidate cache', async () => {
      const categoryDoc = { _id: grandchildId, name: 'Smartphones' };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });
      mockCategoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.delete(grandchildId.toString());

      expect(mockCategoryModel.deleteOne).toHaveBeenCalledWith({ _id: grandchildId });
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should reject deleting a category that has children', async () => {
      const categoryDoc = { _id: rootId, name: 'Electronics' };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });
      mockCategoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
        exec: jest.fn().mockResolvedValue([{ _id: childId }]),
      });

      await expect(service.delete(rootId.toString())).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAttributes', () => {
    it('should replace category attributes and invalidate cache', async () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const categoryDoc = {
        _id: childId,
        attributes: [],
        save: saveMock,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });

      const newAttrs = [
        { name: 'Brand', key: 'brand', type: 'select' as const, options: ['Apple', 'Samsung'], required: true },
      ];

      const result = await service.updateAttributes(childId.toString(), newAttrs as any);

      expect(result.attributes).toEqual(newAttrs);
      expect(saveMock).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should handle multiple attributes with different types', async () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const categoryDoc = {
        _id: childId,
        attributes: [],
        save: saveMock,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });

      const newAttrs = [
        { name: 'Brand', key: 'brand', type: 'select' as const, options: ['Apple', 'Samsung'], required: true },
        { name: 'Storage', key: 'storage', type: 'select' as const, options: ['64GB', '128GB', '256GB'], required: false },
        { name: 'Mileage', key: 'mileage', type: 'number' as const, options: [], required: false, unit: 'km' },
        { name: 'Description', key: 'description', type: 'text' as const, options: [], required: false },
      ];

      const result = await service.updateAttributes(childId.toString(), newAttrs as any);

      expect(result.attributes).toHaveLength(4);
      expect(result.attributes).toEqual(newAttrs);
    });
  });

  describe('updateFilters', () => {
    it('should replace category filters and invalidate cache', async () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const categoryDoc = {
        _id: childId,
        filters: [],
        save: saveMock,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });

      const newFilters = [
        { name: 'Brand', key: 'brand', type: 'select' as const, options: ['Apple', 'Samsung'] },
      ];

      const result = await service.updateFilters(childId.toString(), newFilters as any);

      expect(result.filters).toEqual(newFilters);
      expect(saveMock).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('categories:tree');
    });

    it('should handle multiple filters with different types', async () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const categoryDoc = {
        _id: childId,
        filters: [],
        save: saveMock,
      };
      mockCategoryModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(categoryDoc),
      });

      const newFilters = [
        { name: 'Brand', key: 'brand', type: 'select' as const, options: ['Apple', 'Samsung'] },
        { name: 'Price', key: 'price', type: 'range' as const, options: [], rangeMin: 0, rangeMax: 500000 },
        { name: 'Condition', key: 'condition', type: 'multiselect' as const, options: ['New', 'Used', 'Refurbished'] },
      ];

      const result = await service.updateFilters(childId.toString(), newFilters as any);

      expect(result.filters).toHaveLength(3);
      expect(result.filters).toEqual(newFilters);
    });
  });
});
