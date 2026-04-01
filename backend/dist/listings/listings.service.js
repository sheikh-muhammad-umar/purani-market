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
var ListingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_listing_schema_js_1 = require("./schemas/product-listing.schema.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const category_schema_js_1 = require("../categories/schemas/category.schema.js");
const search_sync_service_js_1 = require("../search/search-sync.service.js");
let ListingsService = ListingsService_1 = class ListingsService {
    listingModel;
    userModel;
    categoryModel;
    searchSyncService;
    logger = new common_1.Logger(ListingsService_1.name);
    constructor(listingModel, userModel, categoryModel, searchSyncService) {
        this.listingModel = listingModel;
        this.userModel = userModel;
        this.categoryModel = categoryModel;
        this.searchSyncService = searchSyncService;
    }
    async findAll(page = 1, limit = 20, sort = 'createdAt', order = 'desc', sellerId) {
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const skip = (safePage - 1) * safeLimit;
        const filter = sellerId
            ? { sellerId: new mongoose_2.Types.ObjectId(sellerId), deletedAt: { $exists: false } }
            : { status: product_listing_schema_js_1.ListingStatus.ACTIVE, deletedAt: { $exists: false } };
        const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
        const [data, total] = await Promise.all([
            this.listingModel.find(filter).sort(sortObj).skip(skip).limit(safeLimit).exec(),
            this.listingModel.countDocuments(filter).exec(),
        ]);
        return { data, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel.findById(id).exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        return listing;
    }
    async findByIdAndIncrementViews(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Listing not found');
        }
        const listing = await this.listingModel
            .findByIdAndUpdate(id, { $inc: { viewCount: 1 } }, { new: true })
            .exec();
        if (!listing) {
            throw new common_1.NotFoundException('Listing not found');
        }
        return listing;
    }
    async update(id, sellerId, dto) {
        const listing = await this.findById(id);
        this.assertOwnership(listing, sellerId);
        if (listing.status === product_listing_schema_js_1.ListingStatus.DELETED) {
            throw new common_1.BadRequestException('Cannot update a deleted listing');
        }
        const updateFields = {};
        if (dto.title !== undefined)
            updateFields.title = dto.title;
        if (dto.description !== undefined)
            updateFields.description = dto.description;
        if (dto.condition !== undefined)
            updateFields.condition = dto.condition;
        if (dto.categoryAttributes !== undefined) {
            updateFields.categoryAttributes = new Map(Object.entries(dto.categoryAttributes));
        }
        if (dto.price !== undefined) {
            updateFields.price = { amount: dto.price.amount, currency: dto.price.currency ?? 'PKR' };
        }
        if (dto.images !== undefined) {
            updateFields.images = dto.images.map((img, idx) => ({
                url: img.url, thumbnailUrl: img.thumbnailUrl, sortOrder: img.sortOrder ?? idx,
            }));
        }
        if (dto.video !== undefined) {
            updateFields.video = { url: dto.video.url, thumbnailUrl: dto.video.thumbnailUrl };
        }
        if (dto.location !== undefined) {
            updateFields.location = {
                type: 'Point', coordinates: dto.location.coordinates,
                city: dto.location.city, area: dto.location.area,
            };
        }
        if (dto.contactInfo !== undefined) {
            updateFields.contactInfo = { phone: dto.contactInfo.phone, email: dto.contactInfo.email };
        }
        updateFields.updatedAt = new Date();
        const updated = await this.listingModel
            .findByIdAndUpdate(id, { $set: updateFields }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Listing not found');
        }
        this.syncToEs(updated);
        return updated;
    }
    async updateStatus(id, sellerId, status) {
        const listing = await this.findById(id);
        this.assertOwnership(listing, sellerId);
        if (listing.status === product_listing_schema_js_1.ListingStatus.DELETED) {
            throw new common_1.BadRequestException('Cannot update status of a deleted listing');
        }
        const updated = await this.listingModel
            .findByIdAndUpdate(id, { $set: { status, updatedAt: new Date() } }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Listing not found');
        }
        this.syncToEs(updated);
        return updated;
    }
    async softDelete(id, userId, userRole) {
        const listing = await this.findById(id);
        const isOwner = listing.sellerId.toString() === userId;
        const isAdmin = userRole === 'admin';
        if (!isOwner && !isAdmin) {
            throw new common_1.ForbiddenException('You are not authorized to delete this listing');
        }
        if (listing.status === product_listing_schema_js_1.ListingStatus.DELETED) {
            throw new common_1.BadRequestException('Listing is already deleted');
        }
        const updated = await this.listingModel
            .findByIdAndUpdate(id, {
            $set: { status: product_listing_schema_js_1.ListingStatus.DELETED, deletedAt: new Date(), updatedAt: new Date() },
        }, { new: true })
            .exec();
        if (!updated) {
            throw new common_1.NotFoundException('Listing not found');
        }
        await this.userModel.updateOne({ _id: listing.sellerId }, { $inc: { activeAdCount: -1 } }).exec();
        this.removeFromEs(id);
        return updated;
    }
    async create(sellerId, dto, moderationEnabled = false) {
        const imageCount = dto.images?.length ?? 0;
        const videoCount = dto.video ? 1 : 0;
        if (imageCount + videoCount < 2) {
            throw new common_1.BadRequestException('At least 2 media items (images or video) are required');
        }
        if (!mongoose_2.Types.ObjectId.isValid(dto.categoryId)) {
            throw new common_1.BadRequestException('Invalid category ID');
        }
        const category = await this.categoryModel.findById(dto.categoryId).exec();
        if (!category) {
            throw new common_1.BadRequestException('Category not found');
        }
        this.validateCategoryAttributes(dto.categoryAttributes ?? {}, category);
        const categoryPath = await this.buildCategoryPath(category);
        const seller = await this.userModel.findById(sellerId).exec();
        if (!seller) {
            throw new common_1.NotFoundException('Seller not found');
        }
        if (seller.activeAdCount >= seller.adLimit) {
            throw new common_1.ForbiddenException('You have reached your free ad limit. Please purchase an ad package to post more ads.');
        }
        if (!seller.phone || !seller.phoneVerified) {
            throw new common_1.ForbiddenException('A verified phone number is required to post ads. Please add and verify your phone number.');
        }
        const status = moderationEnabled ? product_listing_schema_js_1.ListingStatus.PENDING_REVIEW : product_listing_schema_js_1.ListingStatus.ACTIVE;
        const listing = new this.listingModel({
            sellerId: new mongoose_2.Types.ObjectId(sellerId),
            title: dto.title,
            description: dto.description,
            price: { amount: dto.price.amount, currency: dto.price.currency ?? 'PKR' },
            categoryId: new mongoose_2.Types.ObjectId(dto.categoryId),
            categoryPath,
            condition: dto.condition,
            categoryAttributes: dto.categoryAttributes ? new Map(Object.entries(dto.categoryAttributes)) : new Map(),
            images: (dto.images ?? []).map((img, idx) => ({
                url: img.url, thumbnailUrl: img.thumbnailUrl, sortOrder: img.sortOrder ?? idx,
            })),
            video: dto.video ? { url: dto.video.url, thumbnailUrl: dto.video.thumbnailUrl } : undefined,
            location: { type: 'Point', coordinates: dto.location.coordinates, city: dto.location.city, area: dto.location.area },
            contactInfo: { phone: dto.contactInfo?.phone || seller.phone || '', email: dto.contactInfo?.email || seller.email || '' },
            status,
        });
        const saved = await listing.save();
        await this.userModel.updateOne({ _id: new mongoose_2.Types.ObjectId(sellerId) }, { $inc: { activeAdCount: 1 } }).exec();
        this.syncToEs(saved);
        return saved;
    }
    async syncToEs(listing) {
        try {
            await this.searchSyncService.indexListing(listing);
        }
        catch (err) {
            this.logger.warn(`Failed to sync listing ${listing._id} to ES: ${err.message}`);
        }
    }
    async removeFromEs(listingId) {
        try {
            await this.searchSyncService.removeListing(listingId);
        }
        catch (err) {
            this.logger.warn(`Failed to remove listing ${listingId} from ES: ${err.message}`);
        }
    }
    assertOwnership(listing, sellerId) {
        if (listing.sellerId.toString() !== sellerId) {
            throw new common_1.ForbiddenException('You are not authorized to modify this listing');
        }
    }
    validateCategoryAttributes(attributes, category) {
        const definitions = category.attributes ?? [];
        for (const def of definitions) {
            const value = attributes[def.key];
            if (def.required && (value === undefined || value === null || value === '')) {
                throw new common_1.BadRequestException(`Category attribute "${def.name}" is required`);
            }
            if (value === undefined || value === null)
                continue;
            switch (def.type) {
                case category_schema_js_1.AttributeType.TEXT:
                    if (typeof value !== 'string')
                        throw new common_1.BadRequestException(`Category attribute "${def.name}" must be a string`);
                    break;
                case category_schema_js_1.AttributeType.NUMBER:
                    if (typeof value !== 'number')
                        throw new common_1.BadRequestException(`Category attribute "${def.name}" must be a number`);
                    break;
                case category_schema_js_1.AttributeType.BOOLEAN:
                    if (typeof value !== 'boolean')
                        throw new common_1.BadRequestException(`Category attribute "${def.name}" must be a boolean`);
                    break;
                case category_schema_js_1.AttributeType.SELECT:
                    if (def.options && def.options.length > 0 && !def.options.includes(value)) {
                        throw new common_1.BadRequestException(`Category attribute "${def.name}" must be one of: ${def.options.join(', ')}`);
                    }
                    break;
                case category_schema_js_1.AttributeType.MULTISELECT:
                    if (!Array.isArray(value))
                        throw new common_1.BadRequestException(`Category attribute "${def.name}" must be an array`);
                    if (def.options && def.options.length > 0) {
                        for (const v of value) {
                            if (!def.options.includes(v)) {
                                throw new common_1.BadRequestException(`Category attribute "${def.name}" contains invalid option: ${v}`);
                            }
                        }
                    }
                    break;
            }
        }
    }
    async buildCategoryPath(category) {
        const path = [];
        let current = category;
        while (current) {
            path.unshift(current._id);
            if (current.parentId) {
                current = await this.categoryModel.findById(current.parentId).exec();
            }
            else {
                current = null;
            }
        }
        return path;
    }
};
exports.ListingsService = ListingsService;
exports.ListingsService = ListingsService = ListingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_listing_schema_js_1.ProductListing.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_js_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(category_schema_js_1.Category.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        search_sync_service_js_1.SearchSyncService])
], ListingsService);
//# sourceMappingURL=listings.service.js.map