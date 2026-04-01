import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';

export interface NearbyResult {
  data: ProductListingDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

@Injectable()
export class LocationService {
  private readonly DEFAULT_RADIUS_KM = 25;
  private readonly DEFAULT_LIMIT = 20;

  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    private readonly configService: ConfigService,
  ) {}

  async findNearby(
    lat: number,
    lng: number,
    radiusKm?: number,
    limit?: number,
    page?: number,
  ): Promise<NearbyResult> {
    const radius = radiusKm ?? this.DEFAULT_RADIUS_KM;
    const safeLimit = Math.min(Math.max(1, limit ?? this.DEFAULT_LIMIT), 100);
    const safePage = Math.max(1, page ?? 1);
    const skip = (safePage - 1) * safeLimit;

    // Convert km to meters for MongoDB $maxDistance
    const radiusMeters = radius * 1000;

    const filter = {
      status: ListingStatus.ACTIVE,
      deletedAt: { $exists: false },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON: [longitude, latitude]
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    // $near already sorts by distance (closest first)
    const [data, total] = await Promise.all([
      this.listingModel.find(filter).skip(skip).limit(safeLimit).exec(),
      this.listingModel.countDocuments({
        status: ListingStatus.ACTIVE,
        deletedAt: { $exists: false },
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radius / 6378.1], // radius in radians
          },
        },
      }).exec(),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findNearbyForRecommendations(
    lat: number,
    lng: number,
    limit: number = 20,
  ): Promise<ProductListingDocument[]> {
    const radiusMeters = this.DEFAULT_RADIUS_KM * 1000;

    return this.listingModel
      .find({
        status: ListingStatus.ACTIVE,
        deletedAt: { $exists: false },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: radiusMeters,
          },
        },
      })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Geocode a city name or postal code to coordinates using Google Maps Geocoding API.
   * Falls back to a BadRequestException if the location cannot be resolved.
   */
  async geocode(query: string): Promise<GeocodeResult> {
    const apiKey = this.configService.get<string>('google.mapsApiKey');
    if (!apiKey) {
      throw new BadRequestException(
        'Geocoding service is not configured. Please enter coordinates manually.',
      );
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

    const response = await this.fetchGeocode(url);

    if (!response.ok) {
      throw new BadRequestException(
        'Unable to resolve location. Please try a different search term.',
      );
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new BadRequestException(
        'Location not found. Please enter a valid city name or postal code.',
      );
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
    };
  }

  /**
   * Wrapper around fetch for testability.
   */
  protected async fetchGeocode(url: string): Promise<Response> {
    return fetch(url);
  }

  validateCoordinates(lat: number, lng: number): void {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException(
        'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.',
      );
    }
  }
}
