"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const mongoose_2 = require("mongoose");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
let LocationService = class LocationService {
    listingModel;
    configService;
    DEFAULT_RADIUS_KM = 25;
    DEFAULT_LIMIT = 20;
    constructor(listingModel, configService) {
        this.listingModel = listingModel;
        this.configService = configService;
    }
    async findNearby(lat, lng, radiusKm, limit, page) {
        const radius = radiusKm ?? this.DEFAULT_RADIUS_KM;
        const safeLimit = Math.min(Math.max(1, limit ?? this.DEFAULT_LIMIT), 100);
        const safePage = Math.max(1, page ?? 1);
        const skip = (safePage - 1) * safeLimit;
        const radiusMeters = radius * 1000;
        const filter = {
            status: product_listing_schema_js_1.ListingStatus.ACTIVE,
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
        };
        const [data, total] = await Promise.all([
            this.listingModel.find(filter).skip(skip).limit(safeLimit).exec(),
            this.listingModel.countDocuments({
                status: product_listing_schema_js_1.ListingStatus.ACTIVE,
                deletedAt: { $exists: false },
                location: {
                    $geoWithin: {
                        $centerSphere: [[lng, lat], radius / 6378.1],
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
    async findNearbyForRecommendations(lat, lng, limit = 20) {
        const radiusMeters = this.DEFAULT_RADIUS_KM * 1000;
        return this.listingModel
            .find({
            status: product_listing_schema_js_1.ListingStatus.ACTIVE,
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
    async geocode(query) {
        const apiKey = this.configService.get('google.mapsApiKey');
        if (!apiKey) {
            throw new common_1.BadRequestException('Geocoding service is not configured. Please enter coordinates manually.');
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
        const response = await this.fetchGeocode(url);
        if (!response.ok) {
            throw new common_1.BadRequestException('Unable to resolve location. Please try a different search term.');
        }
        const data = await response.json();
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw new common_1.BadRequestException('Location not found. Please enter a valid city name or postal code.');
        }
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        return {
            lat,
            lng,
            formattedAddress: result.formatted_address,
        };
    }
    async fetchGeocode(url) {
        return fetch(url);
    }
    validateCoordinates(lat, lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new common_1.BadRequestException('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.');
        }
    }
};
exports.LocationService = LocationService;
exports.LocationService = LocationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        config_1.ConfigService])
], LocationService);
//# sourceMappingURL=location.service.js.map