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
exports.CreateListingDto = exports.CreateListingContactInfoDto = exports.CreateListingLocationDto = exports.CreateListingVideoDto = exports.CreateListingImageDto = exports.CreateListingPriceDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const product_listing_schema_js_1 = require("../schemas/product-listing.schema.js");
class CreateListingPriceDto {
    amount;
    currency;
}
exports.CreateListingPriceDto = CreateListingPriceDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreateListingPriceDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingPriceDto.prototype, "currency", void 0);
class CreateListingImageDto {
    url;
    thumbnailUrl;
    sortOrder;
}
exports.CreateListingImageDto = CreateListingImageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateListingImageDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingImageDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateListingImageDto.prototype, "sortOrder", void 0);
class CreateListingVideoDto {
    url;
    thumbnailUrl;
}
exports.CreateListingVideoDto = CreateListingVideoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateListingVideoDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingVideoDto.prototype, "thumbnailUrl", void 0);
class CreateListingLocationDto {
    coordinates;
    city;
    area;
}
exports.CreateListingLocationDto = CreateListingLocationDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(2),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], CreateListingLocationDto.prototype, "coordinates", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingLocationDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingLocationDto.prototype, "area", void 0);
class CreateListingContactInfoDto {
    phone;
    email;
}
exports.CreateListingContactInfoDto = CreateListingContactInfoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingContactInfoDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateListingContactInfoDto.prototype, "email", void 0);
class CreateListingDto {
    title;
    description;
    price;
    categoryId;
    condition;
    categoryAttributes;
    images;
    video;
    location;
    contactInfo;
}
exports.CreateListingDto = CreateListingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], CreateListingDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], CreateListingDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreateListingPriceDto),
    __metadata("design:type", CreateListingPriceDto)
], CreateListingDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateListingDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(product_listing_schema_js_1.ListingCondition),
    __metadata("design:type", String)
], CreateListingDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateListingDto.prototype, "categoryAttributes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateListingImageDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateListingDto.prototype, "images", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreateListingVideoDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", CreateListingVideoDto)
], CreateListingDto.prototype, "video", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreateListingLocationDto),
    __metadata("design:type", CreateListingLocationDto)
], CreateListingDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreateListingContactInfoDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", CreateListingContactInfoDto)
], CreateListingDto.prototype, "contactInfo", void 0);
//# sourceMappingURL=create-listing.dto.js.map