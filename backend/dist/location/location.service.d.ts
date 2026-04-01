import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
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
export declare class LocationService {
    private readonly listingModel;
    private readonly configService;
    private readonly DEFAULT_RADIUS_KM;
    private readonly DEFAULT_LIMIT;
    constructor(listingModel: Model<ProductListingDocument>, configService: ConfigService);
    findNearby(lat: number, lng: number, radiusKm?: number, limit?: number, page?: number): Promise<NearbyResult>;
    findNearbyForRecommendations(lat: number, lng: number, limit?: number): Promise<ProductListingDocument[]>;
    geocode(query: string): Promise<GeocodeResult>;
    protected fetchGeocode(url: string): Promise<Response>;
    validateCoordinates(lat: number, lng: number): void;
}
