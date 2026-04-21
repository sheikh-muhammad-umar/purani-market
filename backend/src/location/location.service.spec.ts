import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';
import { ProductListing } from '../listings/schemas/product-listing.schema';

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
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockListings),
          }),
        }),
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockListings),
          }),
        }),
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
      ],
    }).compile();
    service = module.get<LocationService>(LocationService);
  });
  describe('findNearby', () => {
    it('should return nearby listings with default radius (25km)', async () => {
      const result = await service.findNearby(31.52, 74.35);
      expect(result.data).toEqual(mockListings);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockListingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          location: expect.objectContaining({
            $near: expect.objectContaining({
              $geometry: { type: 'Point', coordinates: [74.35, 31.52] },
              $maxDistance: 25000,
            }),
          }),
        }),
      );
    });
    it('should use custom radius when provided', async () => {
      await service.findNearby(31.52, 74.35, 50);
      expect(mockListingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            $near: expect.objectContaining({ $maxDistance: 50000 }),
          }),
        }),
      );
    });
    it('should paginate results correctly', async () => {
      const result = await service.findNearby(31.52, 74.35, 25, 10, 2);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
    it('should clamp limit to max 100', async () => {
      const result = await service.findNearby(31.52, 74.35, 25, 200);
      expect(result.limit).toBe(100);
    });
  });
});
