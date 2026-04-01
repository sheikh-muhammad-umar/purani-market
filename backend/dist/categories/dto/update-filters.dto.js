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
exports.UpdateFiltersDto = exports.CategoryFilterDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const category_schema_js_1 = require("../schemas/category.schema.js");
class CategoryFilterDto {
    name;
    key;
    type;
    options;
    rangeMin;
    rangeMax;
}
exports.CategoryFilterDto = CategoryFilterDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CategoryFilterDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CategoryFilterDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(category_schema_js_1.FilterType),
    __metadata("design:type", String)
], CategoryFilterDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CategoryFilterDto.prototype, "options", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CategoryFilterDto.prototype, "rangeMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CategoryFilterDto.prototype, "rangeMax", void 0);
class UpdateFiltersDto {
    filters;
}
exports.UpdateFiltersDto = UpdateFiltersDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CategoryFilterDto),
    __metadata("design:type", Array)
], UpdateFiltersDto.prototype, "filters", void 0);
//# sourceMappingURL=update-filters.dto.js.map