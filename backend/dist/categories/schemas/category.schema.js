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
exports.CategorySchema = exports.Category = exports.CategoryFilter = exports.CategoryAttribute = exports.FilterType = exports.AttributeType = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var AttributeType;
(function (AttributeType) {
    AttributeType["TEXT"] = "text";
    AttributeType["NUMBER"] = "number";
    AttributeType["SELECT"] = "select";
    AttributeType["MULTISELECT"] = "multiselect";
    AttributeType["BOOLEAN"] = "boolean";
})(AttributeType || (exports.AttributeType = AttributeType = {}));
var FilterType;
(function (FilterType) {
    FilterType["RANGE"] = "range";
    FilterType["SELECT"] = "select";
    FilterType["MULTISELECT"] = "multiselect";
    FilterType["BOOLEAN"] = "boolean";
})(FilterType || (exports.FilterType = FilterType = {}));
let CategoryAttribute = class CategoryAttribute {
    name;
    key;
    type;
    options;
    required;
    unit;
};
exports.CategoryAttribute = CategoryAttribute;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], CategoryAttribute.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], CategoryAttribute.prototype, "key", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: AttributeType, required: true }),
    __metadata("design:type", String)
], CategoryAttribute.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], CategoryAttribute.prototype, "options", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: false }),
    __metadata("design:type", Boolean)
], CategoryAttribute.prototype, "required", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String }),
    __metadata("design:type", String)
], CategoryAttribute.prototype, "unit", void 0);
exports.CategoryAttribute = CategoryAttribute = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], CategoryAttribute);
let CategoryFilter = class CategoryFilter {
    name;
    key;
    type;
    options;
    rangeMin;
    rangeMax;
};
exports.CategoryFilter = CategoryFilter;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], CategoryFilter.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], CategoryFilter.prototype, "key", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: FilterType, required: true }),
    __metadata("design:type", String)
], CategoryFilter.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], CategoryFilter.prototype, "options", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], CategoryFilter.prototype, "rangeMin", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number }),
    __metadata("design:type", Number)
], CategoryFilter.prototype, "rangeMax", void 0);
exports.CategoryFilter = CategoryFilter = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], CategoryFilter);
let Category = class Category {
    _id;
    name;
    slug;
    parentId;
    level;
    attributes;
    filters;
    isActive;
    sortOrder;
    createdAt;
    updatedAt;
};
exports.Category = Category;
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], Category.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true, unique: true }),
    __metadata("design:type", String)
], Category.prototype, "slug", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Category', default: null }),
    __metadata("design:type", Object)
], Category.prototype, "parentId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true, min: 1, max: 3 }),
    __metadata("design:type", Number)
], Category.prototype, "level", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [CategoryAttribute], default: [] }),
    __metadata("design:type", Array)
], Category.prototype, "attributes", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [CategoryFilter], default: [] }),
    __metadata("design:type", Array)
], Category.prototype, "filters", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Boolean, default: true }),
    __metadata("design:type", Boolean)
], Category.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: 0 }),
    __metadata("design:type", Number)
], Category.prototype, "sortOrder", void 0);
exports.Category = Category = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true, collection: 'categories' })
], Category);
exports.CategorySchema = mongoose_1.SchemaFactory.createForClass(Category);
exports.CategorySchema.index({ parentId: 1 });
exports.CategorySchema.index({ slug: 1 });
exports.CategorySchema.index({ level: 1 });
//# sourceMappingURL=category.schema.js.map