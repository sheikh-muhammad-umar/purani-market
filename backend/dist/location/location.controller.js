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
exports.LocationController = void 0;
const common_1 = require("@nestjs/common");
const location_service_js_1 = require("./location.service.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const nearby_query_dto_js_1 = require("./dto/nearby-query.dto.js");
const geocode_query_dto_js_1 = require("./dto/geocode-query.dto.js");
let LocationController = class LocationController {
    locationService;
    constructor(locationService) {
        this.locationService = locationService;
    }
    async getNearbyListings(query) {
        this.locationService.validateCoordinates(query.lat, query.lng);
        return this.locationService.findNearby(query.lat, query.lng, query.radius, query.limit, query.page);
    }
    async geocodeLocation(query) {
        return this.locationService.geocode(query.query);
    }
};
exports.LocationController = LocationController;
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [nearby_query_dto_js_1.NearbyQueryDto]),
    __metadata("design:returntype", Promise)
], LocationController.prototype, "getNearbyListings", null);
__decorate([
    (0, common_1.Get)('geocode'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [geocode_query_dto_js_1.GeocodeQueryDto]),
    __metadata("design:returntype", Promise)
], LocationController.prototype, "geocodeLocation", null);
exports.LocationController = LocationController = __decorate([
    (0, common_1.Controller)('api/location'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __metadata("design:paramtypes", [location_service_js_1.LocationService])
], LocationController);
//# sourceMappingURL=location.controller.js.map