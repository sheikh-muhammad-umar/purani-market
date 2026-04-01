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
exports.PackagesController = void 0;
const common_1 = require("@nestjs/common");
const packages_service_js_1 = require("./packages.service.js");
const jwt_auth_guard_js_1 = require("../common/guards/jwt-auth.guard.js");
const roles_guard_js_1 = require("../common/guards/roles.guard.js");
const roles_decorator_js_1 = require("../common/decorators/roles.decorator.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const purchase_package_dto_js_1 = require("./dto/purchase-package.dto.js");
const create_package_dto_js_1 = require("./dto/create-package.dto.js");
const update_package_dto_js_1 = require("./dto/update-package.dto.js");
let PackagesController = class PackagesController {
    packagesService;
    constructor(packagesService) {
        this.packagesService = packagesService;
    }
    async findAll() {
        return this.packagesService.findAll();
    }
    async getMyPurchases(sellerId) {
        return this.packagesService.getMyPurchases(sellerId);
    }
    async findById(id) {
        return this.packagesService.findById(id);
    }
    async createPackage(dto) {
        return this.packagesService.createPackage(dto);
    }
    async updatePackage(id, dto) {
        return this.packagesService.updatePackage(id, dto);
    }
    async purchasePackages(sellerId, dto) {
        return this.packagesService.purchasePackages(sellerId, dto);
    }
    async paymentCallback(payload) {
        return this.packagesService.handlePaymentCallback(payload);
    }
};
exports.PackagesController = PackagesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('my-purchases'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "getMyPurchases", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard, roles_guard_js_1.RolesGuard),
    (0, roles_decorator_js_1.Roles)(user_schema_js_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_package_dto_js_1.CreatePackageDto]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "createPackage", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard, roles_guard_js_1.RolesGuard),
    (0, roles_decorator_js_1.Roles)(user_schema_js_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_package_dto_js_1.UpdatePackageDto]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "updatePackage", null);
__decorate([
    (0, common_1.Post)('purchase'),
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, purchase_package_dto_js_1.PurchasePackageDto]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "purchasePackages", null);
__decorate([
    (0, common_1.Post)('payment-callback'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagesController.prototype, "paymentCallback", null);
exports.PackagesController = PackagesController = __decorate([
    (0, common_1.Controller)('api/packages'),
    __metadata("design:paramtypes", [packages_service_js_1.PackagesService])
], PackagesController);
//# sourceMappingURL=packages.controller.js.map