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
exports.LocationsController = void 0;
const common_1 = require("@nestjs/common");
const locations_service_js_1 = require("./locations.service.js");
let LocationsController = class LocationsController {
    locationsService;
    constructor(locationsService) {
        this.locationsService = locationsService;
    }
    getProvinces() {
        return this.locationsService.getProvinces();
    }
    getCities(provinceId) {
        return this.locationsService.getCities(provinceId);
    }
    getAreas(cityId) {
        return this.locationsService.getAreas(cityId);
    }
    getSubareas(areaId) {
        return this.locationsService.getSubareas(areaId);
    }
    getBlocks(subareaId) {
        return this.locationsService.getBlocks(subareaId);
    }
    getChildren(parentId) {
        return this.locationsService.getChildren(parentId);
    }
    search(query, limit) {
        return this.locationsService.search(query, limit ? parseInt(limit, 10) : 20);
    }
};
exports.LocationsController = LocationsController;
__decorate([
    (0, common_1.Get)('provinces'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getProvinces", null);
__decorate([
    (0, common_1.Get)('cities/:provinceId'),
    __param(0, (0, common_1.Param)('provinceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getCities", null);
__decorate([
    (0, common_1.Get)('areas/:cityId'),
    __param(0, (0, common_1.Param)('cityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getAreas", null);
__decorate([
    (0, common_1.Get)('subareas/:areaId'),
    __param(0, (0, common_1.Param)('areaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getSubareas", null);
__decorate([
    (0, common_1.Get)('blocks/:subareaId'),
    __param(0, (0, common_1.Param)('subareaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getBlocks", null);
__decorate([
    (0, common_1.Get)('children/:parentId'),
    __param(0, (0, common_1.Param)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "getChildren", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LocationsController.prototype, "search", null);
exports.LocationsController = LocationsController = __decorate([
    (0, common_1.Controller)('api/locations'),
    __metadata("design:paramtypes", [locations_service_js_1.LocationsService])
], LocationsController);
//# sourceMappingURL=locations.controller.js.map