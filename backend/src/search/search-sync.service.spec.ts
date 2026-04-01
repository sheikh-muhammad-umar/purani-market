import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchSyncService } from './search-sync.service';
import { LISTINGS_INDEX, FEATURED_BOOST_FACTOR } from './search-index.service';

describe('SearchSyncService', () => {
  let service: SearchSyncService;
  let mockEsService: any;
  let mockConnection: any;
  let mockChangeStream: any;

  beforeEach(async () => {
    mockChangeStream = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      collection: jest.fn().mockReturnValue({
        watch: jest.fn().mockReturnValue(mockChangeStream),
      }),
    };

    mockEsService = {
      index: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchSyncService,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: ElasticsearchService, useValue: mockEsService },
      ],
    }).compile();

    service = module.get<SearchSyncService>(SearchSyncService);
  });

  describe('startChangeStream', () => {
    it('should watch the product_listings collection', () => {
      service.startChangeStream();

      expect(mockConnection.collection).toHaveBeenCalledWith(
        'product_listings',
      );
      expect(
        mockConnection.collection('product_listings').watch,
      ).toHaveBeenCalledWith([], { fullDocument: 'updateLookup' });
    });

    it('should register change and error event handlers', () => {
      service.startChangeStream();

      expect(mockChangeStream.on).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(mockChangeStream.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });
  });

  describe('stopChangeStream', () => {
    it('should close the change stream', async () => {
      service.startChangeStream();
      await service.stopChangeStream();

      expect(mockChangeStream.close).toHaveBeenCalled();
    });

    it('should handle no active change stream gracefully', async () => {
      await expect(service.stopChangeStream()).resolves.toBeUndefined();
    });
  });

  describe('handleChange', () => {
    it('should call handleInsert for insert operations', async () => {
      const spy = jest
        .spyOn(service, 'handleInsert')
        .mockResolvedValue(undefined);
      const change = { operationType: 'insert', fullDocument: {} };

      await service.handleChange(change);

      expect(spy).toHaveBeenCalledWith(change);
    });

    it('should call handleUpdate for update operations', async () => {
      const spy = jest
        .spyOn(service, 'handleUpdate')
        .mockResolvedValue(undefined);
      const change = { operationType: 'update', fullDocument: {} };

      await service.handleChange(change);

      expect(spy).toHaveBeenCalledWith(change);
    });

    it('should call handleUpdate for replace operations', async () => {
      const spy = jest
        .spyOn(service, 'handleUpdate')
        .mockResolvedValue(undefined);
      const change = { operationType: 'replace', fullDocument: {} };

      await service.handleChange(change);

      expect(spy).toHaveBeenCalledWith(change);
    });

    it('should call handleDelete for delete operations', async () => {
      const spy = jest
        .spyOn(service, 'handleDelete')
        .mockResolvedValue(undefined);
      const change = {
        operationType: 'delete',
        documentKey: { _id: 'abc123' },
      };

      await service.handleChange(change);

      expect(spy).toHaveBeenCalledWith(change);
    });

    it('should not throw for unknown operation types', async () => {
      const change = { operationType: 'drop' };
      await expect(service.handleChange(change)).resolves.toBeUndefined();
    });
  });

  describe('handleInsert', () => {
    const mockDoc = {
      _id: { toString: () => 'listing123' },
      title: 'iPhone 15',
      description: 'Brand new phone',
      price: { amount: 450000, currency: 'PKR' },
      categoryId: { toString: () => 'cat1' },
      categoryPath: [{ toString: () => 'cat0' }, { toString: () => 'cat1' }],
      condition: 'new',
      categoryAttributes: new Map([['brand', 'Apple']]),
      location: { type: 'Point', coordinates: [74.35, 31.52] },
      isFeatured: false,
      status: 'active',
      sellerId: { toString: () => 'seller1' },
      createdAt: new Date('2024-01-01'),
    };

    it('should index the document in Elasticsearch', async () => {
      await service.handleInsert({ fullDocument: mockDoc });

      expect(mockEsService.index).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
        id: 'listing123',
        document: expect.objectContaining({
          title: 'iPhone 15',
          description: 'Brand new phone',
          isFeatured: false,
          status: 'active',
        }),
      });
    });

    it('should skip if fullDocument is null', async () => {
      await service.handleInsert({ fullDocument: null });
      expect(mockEsService.index).not.toHaveBeenCalled();
    });
  });

  describe('handleUpdate', () => {
    const mockDoc = {
      _id: { toString: () => 'listing123' },
      title: 'Updated iPhone',
      description: 'Updated description',
      price: { amount: 400000, currency: 'PKR' },
      categoryId: { toString: () => 'cat1' },
      categoryPath: [],
      condition: 'used',
      categoryAttributes: {},
      isFeatured: true,
      status: 'active',
      sellerId: { toString: () => 'seller1' },
      createdAt: new Date('2024-01-01'),
    };

    it('should re-index the updated document', async () => {
      await service.handleUpdate({ fullDocument: mockDoc });

      expect(mockEsService.index).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
        id: 'listing123',
        document: expect.objectContaining({
          title: 'Updated iPhone',
          isFeatured: true,
        }),
      });
    });

    it('should skip if fullDocument is null', async () => {
      await service.handleUpdate({ fullDocument: null });
      expect(mockEsService.index).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('should delete the document from Elasticsearch', async () => {
      await service.handleDelete({
        documentKey: { _id: { toString: () => 'listing123' } },
      });

      expect(mockEsService.delete).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
        id: 'listing123',
      });
    });

    it('should handle 404 errors gracefully', async () => {
      mockEsService.delete.mockRejectedValue({
        meta: { statusCode: 404 },
      });

      await expect(
        service.handleDelete({
          documentKey: { _id: { toString: () => 'nonexistent' } },
        }),
      ).resolves.toBeUndefined();
    });

    it('should rethrow non-404 errors', async () => {
      const error = new Error('Server error');
      mockEsService.delete.mockRejectedValue(error);

      await expect(
        service.handleDelete({
          documentKey: { _id: { toString: () => 'listing123' } },
        }),
      ).rejects.toThrow('Server error');
    });
  });

  describe('transformToEsDocument', () => {
    it('should transform a MongoDB document to ES format', () => {
      const doc = {
        title: 'Test Listing',
        description: 'A test',
        price: { amount: 1000, currency: 'PKR' },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [{ toString: () => 'cat0' }, { toString: () => 'cat1' }],
        condition: 'new',
        categoryAttributes: new Map([
          ['brand', 'Apple'],
          ['storage', '256GB'],
        ]),
        location: { type: 'Point', coordinates: [74.35, 31.52] },
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date('2024-01-01'),
      };

      const result = service.transformToEsDocument(doc);

      expect(result.title).toBe('Test Listing');
      expect(result.description).toBe('A test');
      expect(result.price).toEqual({ amount: 1000, currency: 'PKR' });
      expect(result.categoryId).toBe('cat1');
      expect(result.categoryPath).toEqual(['cat0', 'cat1']);
      expect(result.condition).toBe('new');
      expect(result.categoryAttributes).toEqual({
        brand: 'Apple',
        storage: '256GB',
      });
      expect(result.location).toEqual({ lat: 31.52, lon: 74.35 });
      expect(result.isFeatured).toBe(false);
      expect(result.status).toBe('active');
      expect(result.sellerId).toBe('seller1');
    });

    it('should handle missing location gracefully', () => {
      const doc = {
        title: 'No Location',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: {},
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.location).toBeUndefined();
    });

    it('should handle location with insufficient coordinates', () => {
      const doc = {
        title: 'Bad Location',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: {},
        location: { type: 'Point', coordinates: [74.35] },
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.location).toBeUndefined();
    });

    it('should handle plain object categoryAttributes', () => {
      const doc = {
        title: 'Test',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: { brand: 'Samsung', color: 'Black' },
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.categoryAttributes).toEqual({
        brand: 'Samsung',
        color: 'Black',
      });
    });

    it('should handle null categoryAttributes', () => {
      const doc = {
        title: 'Test',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: null,
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.categoryAttributes).toEqual({});
    });

    it('should default isFeatured to false when undefined', () => {
      const doc = {
        title: 'Test',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: {},
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.isFeatured).toBe(false);
    });

    it('should default currency to PKR when missing', () => {
      const doc = {
        title: 'Test',
        description: 'Test',
        price: { amount: 500 },
        categoryId: { toString: () => 'cat1' },
        categoryPath: [],
        condition: 'used',
        categoryAttributes: {},
        isFeatured: false,
        status: 'active',
        sellerId: { toString: () => 'seller1' },
        createdAt: new Date(),
      };

      const result = service.transformToEsDocument(doc);
      expect(result.price.currency).toBe('PKR');
    });
  });

  describe('buildFeaturedBoostQuery', () => {
    it('should wrap a base query with function_score for featured boost', () => {
      const baseQuery = { match: { title: 'iphone' } };
      const result = service.buildFeaturedBoostQuery(baseQuery);

      expect(result).toEqual({
        function_score: {
          query: baseQuery,
          functions: [
            {
              filter: { term: { isFeatured: true } },
              weight: FEATURED_BOOST_FACTOR,
            },
          ],
          boost_mode: 'multiply',
          score_mode: 'sum',
        },
      });
    });

    it('should use the correct boost factor', () => {
      const result = service.buildFeaturedBoostQuery({ match_all: {} });
      expect(result.function_score.functions[0].weight).toBe(
        FEATURED_BOOST_FACTOR,
      );
    });
  });
});
