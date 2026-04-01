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
exports.ListingsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const listings_service_js_1 = require("./listings.service.js");
const media_service_js_1 = require("./media.service.js");
const packages_service_js_1 = require("../packages/packages.service.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const optional_jwt_auth_guard_js_1 = require("../common/guards/optional-jwt-auth.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const create_listing_dto_js_1 = require("./dto/create-listing.dto.js");
const update_listing_dto_js_1 = require("./dto/update-listing.dto.js");
const update_status_dto_js_1 = require("./dto/update-status.dto.js");
const upload_media_dto_js_1 = require("./dto/upload-media.dto.js");
let ListingsController = class ListingsController {
    listingsService;
    mediaService;
    packagesService;
    constructor(listingsService, mediaService, packagesService) {
        this.listingsService = listingsService;
        this.mediaService = mediaService;
        this.packagesService = packagesService;
    }
    async getListings(page, limit, sort, order, mine, userId) {
        const sellerId = mine === 'true' && userId ? userId : undefined;
        return this.listingsService.findAll(page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20, sort || 'createdAt', (order === 'asc' ? 'asc' : 'desc'), sellerId);
    }
    async getListingById(id) {
        return this.listingsService.findByIdAndIncrementViews(id);
    }
    async createListing(sellerId, dto) {
        return this.listingsService.create(sellerId, dto);
    }
    async updateListing(id, sellerId, dto) {
        return this.listingsService.update(id, sellerId, dto);
    }
    async updateListingStatus(id, sellerId, dto) {
        return this.listingsService.updateStatus(id, sellerId, dto.status);
    }
    async deleteListing(id, userId, userRole) {
        return this.listingsService.softDelete(id, userId, userRole);
    }
    async featureListing(id, sellerId) {
        return this.packagesService.featureListing(id, sellerId);
    }
    async uploadMedia(listingId, sellerId, file, dto) {
        return this.mediaService.uploadMedia(listingId, sellerId, file, dto.type, dto.sortOrder);
    }
};
exports.ListingsController = ListingsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(optional_jwt_auth_guard_js_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('sort')),
    __param(3, (0, common_1.Query)('order')),
    __param(4, (0, common_1.Query)('mine')),
    __param(5, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "getListings", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "getListingById", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_listing_dto_js_1.CreateListingDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "createListing", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_listing_dto_js_1.UpdateListingDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_status_dto_js_1.UpdateStatusDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "updateListingStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "deleteListing", null);
__decorate([
    (0, common_1.Post)(':id/feature'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "featureListing", null);
__decorate([
    (0, common_1.Post)(':id/media'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, upload_media_dto_js_1.UploadMediaDto]),
    __metadata("design:returntype", Promise)
], ListingsController.prototype, "uploadMedia", null);
exports.ListingsController = ListingsController = __decorate([
    (0, common_1.Controller)('api/listings'),
    __metadata("design:paramtypes", [listings_service_js_1.ListingsService,
        media_service_js_1.MediaService,
        packages_service_js_1.PackagesService])
], ListingsController);
//# sourceMappingURL=listings.controller.js.map