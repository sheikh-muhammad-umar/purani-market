import { LocationService } from './location.service.js';
import { NearbyQueryDto } from './dto/nearby-query.dto.js';
import { GeocodeQueryDto } from './dto/geocode-query.dto.js';
export declare class LocationController {
    private readonly locationService;
    constructor(locationService: LocationService);
    getNearbyListings(query: NearbyQueryDto): Promise<import("./location.service.js").NearbyResult>;
    geocodeLocation(query: GeocodeQueryDto): Promise<import("./location.service.js").GeocodeResult>;
}
