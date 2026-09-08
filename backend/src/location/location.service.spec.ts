import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';
import { ProductListing } from '../listings/schemas/product-listing.schema';
import { Types } from 'mongoose';

describe('LocationService', () => {
  let service: LocationService;
  let mockListingModel: any;
  const mockListings = [
    {
      _id: 'listing1',
      title: 'Nearby Listing 1',
      location: { type: 'Point', coordinates: [74.35, 31.52] },
      status: 'active',
    },
    {
      _id: 'listing2',
      title: 'Nearby Listing 2',
      location: { type: 'Point', coordinates: [74.36, 31.53] },
      status: 'active',
    },
  ];
  beforeEach(async () => {
    mockListingModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockListings),
      }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(2) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ google: { mapsApiKey: 'test-api-key' } })],
        }),
      ],
      providers: [
        LocationService,
        {
          provide: getModelToken(ProductListing.name),
          useValue: mockListingModel,
        },
        {
          provide: getModelToken('Province'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            findById: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(null),
            }),
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
        {
          provide: getModelToken('City'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
        {
          provide: getModelToken('Area'),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            aggregate: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
            countDocuments: jest
              .fn()
              .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
          },
        },
      ],
    }).compile();
    service = module.get<LocationService>(LocationService);
  });
  describe('findNearby', () => {
    const validCityId = new Types.ObjectId().toString();
    it('should return nearby listings filtered by city', async () => {
      const result = await service.findNearby({ cityId: validCityId });
      expect(result.data).toEqual(mockListings);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
    it('should paginate results correctly', async () => {
      const result = await service.findNearby({ cityId: validCityId }, 10, 2);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
    it('should clamp limit to max 100', async () => {
      const result = await service.findNearby({ cityId: validCityId }, 200);
      expect(result.limit).toBe(100);
    });

    it('should not sort by isFeatured', async () => {
      // `isFeatured: -1` led this sort, so once the cascade fell back to a wider
      // level every featured listing came before any organic one and the rail
      // showed nothing but featured ads.
      await service.findNearby({ cityId: validCityId });

      const sortArg = mockListingModel.find.mock.results[0].value.sort.mock
        .calls[0][0] as Record<string, number>;
      expect(sortArg).toEqual({ createdAt: -1 });
    });

    it('should reserve bounded promoted slots', async () => {
      mockListingModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(100) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(10) });

      await service.findNearby({ cityId: validCityId }, 20);

      const [featuredFilter, organicFilter] =
        mockListingModel.find.mock.calls.map((call: any[]) => call[0]);
      expect(featuredFilter.isFeatured).toBe(true);
      expect(featuredFilter.featuredUntil.$gt).toBeInstanceOf(Date);
      expect(organicFilter.isFeatured).toBeUndefined();
      // Both halves stay inside the location the caller asked for.
      expect(featuredFilter['location.cityId']).toBeDefined();
      expect(organicFilter['location.cityId']).toBeDefined();
    });

    it('should scale slots down for the smaller home rail', async () => {
      // The "Near You" rail asks for 12. A flat three would make a quarter of it
      // promoted, so the slot count follows the page size.
      mockListingModel.countDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(100) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(10) });

      await service.findNearby({ cityId: validCityId }, 12);

      // The mock hands back one shared query object, so both calls land on it.
      const limitCalls =
        mockListingModel.find.mock.results[0].value.limit.mock.calls.map(
          (call: any[]) => call[0],
        );
      expect(limitCalls).toEqual([2, 10]);
    });
  });
});
