import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { AdminTrackerService } from '../ai/admin-tracker.service';

describe('LocationController', () => {
  let controller: LocationController;
  let mockLocationService: Partial<Record<keyof LocationService, jest.Mock>>;

  const mockNearbyResult = {
    data: [
      {
        _id: 'listing1',
        title: 'Nearby 1',
        location: { type: 'Point', coordinates: [74.35, 31.52] },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  const mockGeocodeResult = {
    lat: 31.5204,
    lng: 74.3587,
    formattedAddress: 'Lahore, Punjab, Pakistan',
  };

  beforeEach(async () => {
    mockLocationService = {
      findNearby: jest.fn().mockResolvedValue(mockNearbyResult),
      validateCoordinates: jest.fn(),
      geocode: jest.fn().mockResolvedValue(mockGeocodeResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationController],
      providers: [
        { provide: LocationService, useValue: mockLocationService },
        { provide: AdminTrackerService, useValue: { track: jest.fn() } },
        Reflector,
      ],
    }).compile();

    controller = module.get<LocationController>(LocationController);
  });

  describe('getNearbyListings', () => {
    it('should return nearby listings with location IDs', async () => {
      const result = await controller.getNearbyListings(
        undefined,
        'city-id-1',
        undefined,
        undefined,
        undefined,
      );

      expect(mockLocationService.findNearby).toHaveBeenCalledWith(
        { provinceId: undefined, cityId: 'city-id-1', areaId: undefined },
        undefined,
        undefined,
      );
      expect(result).toEqual(mockNearbyResult);
    });

    it('should pass limit and page to service', async () => {
      await controller.getNearbyListings(
        'province-id-1',
        'city-id-1',
        undefined,
        '10',
        '2',
      );

      expect(mockLocationService.findNearby).toHaveBeenCalledWith(
        {
          provinceId: 'province-id-1',
          cityId: 'city-id-1',
          areaId: undefined,
        },
        10,
        2,
      );
    });
  });

  describe('geocodeLocation', () => {
    it('should return geocoded coordinates for a city name', async () => {
      const result = await controller.geocodeLocation({ query: 'Lahore' });

      expect(mockLocationService.geocode).toHaveBeenCalledWith('Lahore');
      expect(result).toEqual(mockGeocodeResult);
    });

    it('should return geocoded coordinates for a postal code', async () => {
      await controller.geocodeLocation({ query: '44000' });

      expect(mockLocationService.geocode).toHaveBeenCalledWith('44000');
    });

    it('should propagate BadRequestException when geocoding fails', async () => {
      mockLocationService.geocode!.mockRejectedValue(
        new BadRequestException('Location not found'),
      );

      await expect(
        controller.geocodeLocation({ query: 'xyznonexistent' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
