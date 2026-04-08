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
exports.LocationSchema = exports.Location = exports.LocationLevel = void 0;
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
let Location = class Location {
    _id;
    name;
    slug;
    level;
    parentId;
    hierarchyPath;
    isActive;
    sortOrder;
    createdAt;
    updatedAt;
};
exports.Location = Location;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Location.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, index: true }),
    __metadata("design:type", String)
], Location.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: LocationLevel, required: true, index: true }),
    __metadata("design:type", String)
], Location.prototype, "level", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Location', default: null, index: true }),
    __metadata("design:type", Object)
], Location.prototype, "parentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Location.prototype, "hierarchyPath", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], Location.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Location.prototype, "sortOrder", void 0);
exports.Location = Location = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'locations' })
], Location);
exports.LocationSchema = mongoose_1.SchemaFactory.createForClass(Location);
exports.LocationSchema.index({ parentId: 1, level: 1 });
exports.LocationSchema.index({ slug: 1, level: 1 });
//# sourceMappingURL=location.schema.js.map