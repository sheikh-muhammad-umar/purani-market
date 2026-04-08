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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PakistanLocationSchema = exports.PakistanLocation = exports.LocationLevel = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var LocationLevel;
(function (LocationLevel) {
    LocationLevel["PROVINCE"] = "province";
    LocationLevel["CITY"] = "city";
    LocationLevel["AREA"] = "area";
    LocationLevel["SUBAREA"] = "subarea";
    LocationLevel["BLOCK"] = "block";
})(LocationLevel || (exports.LocationLevel = LocationLevel = {}));
let PakistanLocation = class PakistanLocation {
    _id;
    name;
    level;
    parentId;
    hierarchyPath;
    isActive;
    sortOrder;
};
exports.PakistanLocation = PakistanLocation;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], PakistanLocation.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: LocationLevel, required: true }),
    __metadata("design:type", String)
], PakistanLocation.prototype, "level", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'PakistanLocation', default: null }),
    __metadata("design:type", Object)
], PakistanLocation.prototype, "parentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: '' }),
    __metadata("design:type", String)
], PakistanLocation.prototype, "hierarchyPath", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], PakistanLocation.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], PakistanLocation.prototype, "sortOrder", void 0);
exports.PakistanLocation = PakistanLocation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'pakistan_locations' })
], PakistanLocation);
exports.PakistanLocationSchema = mongoose_1.SchemaFactory.createForClass(PakistanLocation);
exports.PakistanLocationSchema.index({ level: 1, parentId: 1 });
exports.PakistanLocationSchema.index({ parentId: 1, name: 1 });
exports.PakistanLocationSchema.index({ name: 'text' });
//# sourceMappingURL=pakistan-location.schema.js.map