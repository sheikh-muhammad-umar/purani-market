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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ioredis_1 = require("@nestjs-modules/ioredis");
const ioredis_2 = __importDefault(require("ioredis"));
const category_schema_js_1 = require("./schemas/category.schema.js");
const CACHE_KEY_TREE = 'categories:tree';
const CACHE_TTL_SECONDS = 3600;
let CategoriesService = class CategoriesService {
    categoryModel;
    redis;
    constructor(categoryModel, redis) {
        this.categoryModel = categoryModel;
        this.redis = redis;
    }
    async getCategoryTree() {
        const cached = await this.redis.get(CACHE_KEY_TREE);
        if (cached) {
            return JSON.parse(cached);
        }
        const categories = await this.categoryModel
            .find({ isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean()
            .exec();
        const tree = this.buildTree(categories);
        await this.redis.set(CACHE_KEY_TREE, JSON.stringify(tree), 'EX', CACHE_TTL_SECONDS);
        return tree;
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Category not found');
        }
        const category = await this.categoryModel.findById(id).exec();
        if (!category) {
            throw new common_1.NotFoundException('Category not found');
        }
        return category;
    }
    async create(dto) {
        let level = 1;
        if (dto.parentId) {
            const parent = await this.findById(dto.parentId);
            if (parent.level >= 3) {
                throw new common_1.BadRequestException('Maximum category nesting depth is 3 levels');
            }
            level = parent.level + 1;
        }
        const slug = dto.slug || this.generateSlug(dto.name);
        const category = new this.categoryModel({
            name: dto.name,
            slug,
            parentId: dto.parentId || null,
            level,
            isActive: dto.isActive ?? true,
            sortOrder: dto.sortOrder ?? 0,
            attributes: [],
            filters: [],
        });
        const saved = await category.save();
        await this.invalidateCache();
        return saved;
    }
    async update(id, dto) {
        const category = await this.findById(id);
        if (dto.name !== undefined)
            category.name = dto.name;
        if (dto.slug !== undefined)
            category.slug = dto.slug;
        if (dto.isActive !== undefined)
            category.isActive = dto.isActive;
        if (dto.sortOrder !== undefined)
            category.sortOrder = dto.sortOrder;
        const saved = await category.save();
        await this.invalidateCache();
        return saved;
    }
    async delete(id) {
        const category = await this.findById(id);
        const children = await this.categoryModel.find({ parentId: category._id }).exec();
        if (children.length > 0) {
            throw new common_1.BadRequestException('Cannot delete a category that has subcategories');
        }
        await this.categoryModel.deleteOne({ _id: category._id }).exec();
        await this.invalidateCache();
    }
    async updateAttributes(id, attributes) {
        const category = await this.findById(id);
        category.attributes = attributes;
        const saved = await category.save();
        await this.invalidateCache();
        return saved;
    }
    async updateFilters(id, filters) {
        const category = await this.findById(id);
        category.filters = filters;
        const saved = await category.save();
        await this.invalidateCache();
        return saved;
    }
    async invalidateCache() {
        await this.redis.del(CACHE_KEY_TREE);
    }
    generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
    buildTree(categories) {
        const map = new Map();
        const roots = [];
        for (const cat of categories) {
            const node = {
                _id: cat._id.toString(),
                name: cat.name,
                slug: cat.slug,
                parentId: cat.parentId ? cat.parentId.toString() : null,
                level: cat.level,
                isActive: cat.isActive,
                sortOrder: cat.sortOrder,
                children: [],
            };
            map.set(node._id, node);
        }
        for (const node of map.values()) {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId).children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(category_schema_js_1.Category.name)),
    __param(1, (0, ioredis_1.InjectRedis)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        ioredis_2.default])
], CategoriesService);
//# sourceMappingURL=categories.service.js.map