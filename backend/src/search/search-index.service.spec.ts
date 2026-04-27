import { Test, TestingModule } from '@nestjs/testing';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  SearchIndexService,
  LISTINGS_INDEX,
  listingsIndexMapping,
  listingsIndexSettings,
} from './search-index.service';

describe('SearchIndexService', () => {
  let service: SearchIndexService;
  let mockEsService: any;

  beforeEach(async () => {
    mockEsService = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchIndexService,
        { provide: ElasticsearchService, useValue: mockEsService },
      ],
    }).compile();

    service = module.get<SearchIndexService>(SearchIndexService);
  });

  describe('ensureIndex', () => {
    it('should create index if it does not exist', async () => {
      mockEsService.indices.exists.mockResolvedValue(false);
      mockEsService.indices.create.mockResolvedValue({});

      await service.ensureIndex();

      expect(mockEsService.indices.exists).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
      });
      expect(mockEsService.indices.create).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
        settings: listingsIndexSettings,
        mappings: listingsIndexMapping,
      });
    });

    it('should not create index if it already exists', async () => {
      mockEsService.indices.exists.mockResolvedValue(true);

      await service.ensureIndex();

      expect(mockEsService.indices.exists).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
      });
      expect(mockEsService.indices.create).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      mockEsService.indices.exists.mockRejectedValue(
        new Error('Connection refused'),
      );

      await expect(service.ensureIndex()).resolves.toBeUndefined();
    });
  });

  describe('createIndex', () => {
    it('should create index with correct mapping', async () => {
      mockEsService.indices.create.mockResolvedValue({});

      await service.createIndex();

      expect(mockEsService.indices.create).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
        settings: listingsIndexSettings,
        mappings: listingsIndexMapping,
      });
    });
  });

  describe('deleteIndex', () => {
    it('should delete index if it exists', async () => {
      mockEsService.indices.exists.mockResolvedValue(true);
      mockEsService.indices.delete.mockResolvedValue({});

      await service.deleteIndex();

      expect(mockEsService.indices.delete).toHaveBeenCalledWith({
        index: LISTINGS_INDEX,
      });
    });

    it('should not attempt delete if index does not exist', async () => {
      mockEsService.indices.exists.mockResolvedValue(false);

      await service.deleteIndex();

      expect(mockEsService.indices.delete).not.toHaveBeenCalled();
    });
  });

  describe('index mapping', () => {
    it('should define title as text type', () => {
      expect(listingsIndexMapping.properties.title.type).toBe('text');
    });

    it('should define description as text type', () => {
      expect(listingsIndexMapping.properties.description.type).toBe('text');
    });

    it('should define price.amount as float type', () => {
      expect(listingsIndexMapping.properties['price.amount'].type).toBe(
        'float',
      );
    });

    it('should define categoryId as keyword type', () => {
      expect(listingsIndexMapping.properties.categoryId.type).toBe('keyword');
    });

    it('should define categoryPath as keyword type', () => {
      expect(listingsIndexMapping.properties.categoryPath.type).toBe('keyword');
    });

    it('should define location as geo_point type', () => {
      expect(listingsIndexMapping.properties.location.type).toBe('geo_point');
    });

    it('should define isFeatured as boolean type', () => {
      expect(listingsIndexMapping.properties.isFeatured.type).toBe('boolean');
    });

    it('should define status as keyword type', () => {
      expect(listingsIndexMapping.properties.status.type).toBe('keyword');
    });

    it('should define sellerId as keyword type', () => {
      expect(listingsIndexMapping.properties.sellerId.type).toBe('keyword');
    });

    it('should define createdAt as date type', () => {
      expect(listingsIndexMapping.properties.createdAt.type).toBe('date');
    });

    it('should define condition as keyword type', () => {
      expect(listingsIndexMapping.properties.condition.type).toBe('keyword');
    });

    it('should define categoryAttributes as object type', () => {
      expect(listingsIndexMapping.properties.categoryAttributes.type).toBe(
        'object',
      );
    });
  });

  describe('onModuleInit', () => {
    it('should call ensureIndex on module init', async () => {
      mockEsService.indices.exists.mockResolvedValue(false);
      mockEsService.indices.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockEsService.indices.exists).toHaveBeenCalled();
    });
  });
});
