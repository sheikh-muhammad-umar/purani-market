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
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const pakistan_location_schema_js_1 = require("./schemas/pakistan-location.schema.js");
let LocationsService = class LocationsService {
    locationModel;
    constructor(locationModel) {
        this.locationModel = locationModel;
    }
    async getProvinces() {
        return this.locationModel
            .find({ level: pakistan_location_schema_js_1.LocationLevel.PROVINCE, isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level')
            .lean()
            .exec();
    }
    async getCities(provinceId) {
        return this.locationModel
            .find({
            level: pakistan_location_schema_js_1.LocationLevel.CITY,
            parentId: new mongoose_2.Types.ObjectId(provinceId),
            isActive: true,
        })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level parentId')
            .lean()
            .exec();
    }
    async getAreas(cityId) {
        return this.locationModel
            .find({
            level: pakistan_location_schema_js_1.LocationLevel.AREA,
            parentId: new mongoose_2.Types.ObjectId(cityId),
            isActive: true,
        })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level parentId')
            .lean()
            .exec();
    }
    async getSubareas(areaId) {
        return this.locationModel
            .find({
            level: pakistan_location_schema_js_1.LocationLevel.SUBAREA,
            parentId: new mongoose_2.Types.ObjectId(areaId),
            isActive: true,
        })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level parentId')
            .lean()
            .exec();
    }
    async getBlocks(subareaId) {
        return this.locationModel
            .find({
            level: pakistan_location_schema_js_1.LocationLevel.BLOCK,
            parentId: new mongoose_2.Types.ObjectId(subareaId),
            isActive: true,
        })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level parentId')
            .lean()
            .exec();
    }
    async getChildren(parentId) {
        return this.locationModel
            .find({
            parentId: new mongoose_2.Types.ObjectId(parentId),
            isActive: true,
        })
            .sort({ sortOrder: 1, name: 1 })
            .select('name level parentId')
            .lean()
            .exec();
    }
    async search(query, limit = 20) {
        return this.locationModel
            .find({
            name: { $regex: query, $options: 'i' },
            isActive: true,
        })
            .sort({ level: 1, name: 1 })
            .limit(limit)
            .select('name level parentId hierarchyPath')
            .lean()
            .exec();
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(pakistan_location_schema_js_1.PakistanLocation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], LocationsService);
//# sourceMappingURL=locations.service.js.map