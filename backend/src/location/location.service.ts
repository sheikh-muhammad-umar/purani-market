import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { Province, ProvinceDocument } from './schemas/province.schema.js';
import { City, CityDocument } from './schemas/city.schema.js';
import { Area, AreaDocument } from './schemas/area.schema.js';

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
    @InjectModel(Province.name)
    private readonly provinceModel: Model<ProvinceDocument>,
    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,
    @InjectModel(Area.name)
    private readonly areaModel: Model<AreaDocument>,
    private readonly configService: ConfigService,
  ) {}

  async getProvinces(): Promise<(ProvinceDocument & { cityCount: number })[]> {
    const provinces = await this.provinceModel.find().sort({ name: 1 }).lean().exec();
    const counts = await this.cityModel.aggregate([
      { $group: { _id: '$provinceId', count: { $sum: 1 } } },
    ]).exec();
    const countMap = new Map(counts.map((c: any) => [c._id.toString(), c.count]));
    return provinces.map((p: any) => ({ ...p, cityCount: countMap.get(p._id.toString()) || 0 }));
  }

  async getCitiesByProvince(provinceId: string): Promise<(CityDocument & { areaCount: number })[]> {
    const cities = await this.cityModel.find({ provinceId: new Types.ObjectId(provinceId) }).sort({ name: 1 }).lean().exec();
    const cityIds = cities.map((c: any) => c._id);
    const counts = await this.areaModel.aggregate([
      { $match: { cityId: { $in: cityIds } } },
      { $group: { _id: '$cityId', count: { $sum: 1 } } },
    ]).exec();
    const countMap = new Map(counts.map((c: any) => [c._id.toString(), c.count]));
    return cities.map((c: any) => ({ ...c, areaCount: countMap.get(c._id.toString()) || 0 }));
  }

  async getAreasByCity(cityId: string): Promise<AreaDocument[]> {
    return this.areaModel.find({ cityId: new Types.ObjectId(cityId) }).sort({ name: 1 }).exec();
  }

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

  // ── Admin CRUD: Provinces ─────────────────────────────────────────

  async createProvince(name: string): Promise<ProvinceDocument> {
    const exists = await this.provinceModel.findOne({ name }).exec();
    if (exists) throw new ConflictException(`Province "${name}" already exists`);
    return this.provinceModel.create({ name });
  }

  async updateProvince(id: string, name: string): Promise<ProvinceDocument> {
    const doc = await this.provinceModel.findByIdAndUpdate(id, { name }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Province not found');
    // Cascade: update denormalized name on all listings in this province
    await this.listingModel.updateMany(
      { 'location.provinceId': new Types.ObjectId(id) },
      { $set: { 'location.province': name } },
    ).exec();
    return doc;
  }

  async deleteProvince(id: string): Promise<void> {
    const cities = await this.cityModel.countDocuments({ provinceId: new Types.ObjectId(id) }).exec();
    if (cities > 0) throw new BadRequestException(`Cannot delete province with ${cities} cities. Delete cities first.`);
    const result = await this.provinceModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Province not found');
  }

  // ── Admin CRUD: Cities ────────────────────────────────────────────

  async createCity(name: string, provinceId: string): Promise<CityDocument> {
    const province = await this.provinceModel.findById(provinceId).exec();
    if (!province) throw new NotFoundException('Province not found');
    const exists = await this.cityModel.findOne({ name, provinceId: new Types.ObjectId(provinceId) }).exec();
    if (exists) throw new ConflictException(`City "${name}" already exists in this province`);
    return this.cityModel.create({ name, provinceId: new Types.ObjectId(provinceId) });
  }

  async updateCity(id: string, name: string): Promise<CityDocument> {
    const doc = await this.cityModel.findByIdAndUpdate(id, { name }, { new: true }).exec();
    if (!doc) throw new NotFoundException('City not found');
    // Cascade: update denormalized name on all listings in this city
    await this.listingModel.updateMany(
      { 'location.cityId': new Types.ObjectId(id) },
      { $set: { 'location.city': name } },
    ).exec();
    return doc;
  }

  async deleteCity(id: string): Promise<void> {
    const areas = await this.areaModel.countDocuments({ cityId: new Types.ObjectId(id) }).exec();
    if (areas > 0) throw new BadRequestException(`Cannot delete city with ${areas} areas. Delete areas first.`);
    const result = await this.cityModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('City not found');
  }

  // ── Admin CRUD: Areas ─────────────────────────────────────────────

  async createArea(name: string, cityId: string, subareas: string[] = [], blockPhases: string[] = []): Promise<AreaDocument> {
    const city = await this.cityModel.findById(cityId).exec();
    if (!city) throw new NotFoundException('City not found');
    const exists = await this.areaModel.findOne({ name, cityId: new Types.ObjectId(cityId) }).exec();
    if (exists) throw new ConflictException(`Area "${name}" already exists in this city`);
    return this.areaModel.create({ name, cityId: new Types.ObjectId(cityId), subareas, blockPhases });
  }

  async updateArea(id: string, updates: { name?: string; subareas?: string[]; blockPhases?: string[] }): Promise<AreaDocument> {
    const doc = await this.areaModel.findByIdAndUpdate(id, updates, { new: true }).exec();
    if (!doc) throw new NotFoundException('Area not found');
    // Cascade: update denormalized name on all listings in this area
    if (updates.name) {
      await this.listingModel.updateMany(
        { 'location.areaId': new Types.ObjectId(id) },
        { $set: { 'location.area': updates.name } },
      ).exec();
    }
    return doc;
  }

  async deleteArea(id: string): Promise<void> {
    const result = await this.areaModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Area not found');
  }

  // ── Admin Stats ───────────────────────────────────────────────────

  async getLocationStats(): Promise<{ provinces: number; cities: number; areas: number }> {
    const [provinces, cities, areas] = await Promise.all([
      this.provinceModel.countDocuments().exec(),
      this.cityModel.countDocuments().exec(),
      this.areaModel.countDocuments().exec(),
    ]);
    return { provinces, cities, areas };
  }
}
