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
exports.UpdateListingDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const product_listing_schema_js_1 = require("../schemas/product-listing.schema.js");
const create_listing_dto_js_1 = require("./create-listing.dto.js");
class UpdateListingDto {
    title;
    description;
    price;
    condition;
    categoryAttributes;
    images;
    video;
    location;
    contactInfo;
}
exports.UpdateListingDto = UpdateListingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => create_listing_dto_js_1.CreateListingPriceDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", create_listing_dto_js_1.CreateListingPriceDto)
], UpdateListingDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(product_listing_schema_js_1.ListingCondition),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateListingDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateListingDto.prototype, "categoryAttributes", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_listing_dto_js_1.CreateListingImageDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateListingDto.prototype, "images", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => create_listing_dto_js_1.CreateListingVideoDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", create_listing_dto_js_1.CreateListingVideoDto)
], UpdateListingDto.prototype, "video", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => create_listing_dto_js_1.CreateListingLocationDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", create_listing_dto_js_1.CreateListingLocationDto)
], UpdateListingDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => create_listing_dto_js_1.CreateListingContactInfoDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", create_listing_dto_js_1.CreateListingContactInfoDto)
], UpdateListingDto.prototype, "contactInfo", void 0);
//# sourceMappingURL=update-listing.dto.js.map