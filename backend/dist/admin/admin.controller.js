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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const index_js_1 = require("../common/guards/index.js");
const index_js_2 = require("../common/decorators/index.js");
const user_schema_js_1 = require("../users/schemas/user.schema.js");
const admin_service_js_1 = require("./admin.service.js");
const list_users_query_dto_js_1 = require("./dto/list-users-query.dto.js");
const update_user_status_dto_js_1 = require("./dto/update-user-status.dto.js");
const update_user_role_dto_js_1 = require("./dto/update-user-role.dto.js");
const update_ad_limit_dto_js_1 = require("./dto/update-ad-limit.dto.js");
const reject_listing_dto_js_1 = require("./dto/reject-listing.dto.js");
const list_purchases_query_dto_js_1 = require("./dto/list-purchases-query.dto.js");
const list_payments_query_dto_js_1 = require("./dto/list-payments-query.dto.js");
let AdminController = class AdminController {
    adminService;
    constructor(adminService) {
        this.adminService = adminService;
    }
    async listUsers(query) {
        const result = await this.adminService.listUsers(query);
        const enrichedData = await Promise.all(result.data.map(async (user) => {
            const activity = await this.adminService.getUserActivitySummary(user._id.toString());
            return { ...user, activitySummary: activity };
        }));
        return { ...result, data: enrichedData };
    }
    async updateUserStatus(id, dto) {
        const user = await this.adminService.updateUserStatus(id, dto.status);
        return { message: `User status updated to ${dto.status}`, userId: user._id };
    }
    async updateUserRole(id, dto) {
        const user = await this.adminService.updateUserRole(id, dto.role);
        return { message: `User role updated to ${dto.role}`, userId: user._id };
    }
    async updateAdLimit(id, dto) {
        const user = await this.adminService.updateAdLimit(id, dto.adLimit);
        return {
            message: `Ad limit updated to ${dto.adLimit}`,
            userId: user._id,
            adLimit: user.adLimit,
        };
    }
    async getPendingListings(page, limit) {
        return this.adminService.getPendingListings(page, limit);
    }
    async approveListing(id) {
        const listing = await this.adminService.approveListing(id);
        return {
            message: 'Listing approved',
            listingId: listing._id,
            status: listing.status,
        };
    }
    async rejectListing(id, dto) {
        const listing = await this.adminService.rejectListing(id, dto.rejectionReason);
        return {
            message: 'Listing rejected',
            listingId: listing._id,
            status: listing.status,
            rejectionReason: listing.rejectionReason,
        };
    }
    async getAnalytics(dateFrom, dateTo) {
        return this.adminService.getAnalytics(dateFrom, dateTo);
    }
    async exportAnalytics(dateFrom, dateTo) {
        const now = new Date();
        const from = dateFrom || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
        const to = dateTo || now.toISOString().split('T')[0];
        return this.adminService.exportAnalytics(from, to);
    }
    async listPackagePurchases(query) {
        return this.adminService.listPackagePurchases(query);
    }
    async listPayments(query) {
        return this.adminService.listPayments(query);
    }
    async getSellerAdInfo(id) {
        return this.adminService.getSellerAdInfo(id);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_users_query_dto_js_1.ListUsersQueryDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Patch)('users/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_status_dto_js_1.UpdateUserStatusDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Patch)('users/:id/role'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_role_dto_js_1.UpdateUserRoleDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUserRole", null);
__decorate([
    (0, common_1.Patch)('users/:id/ad-limit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ad_limit_dto_js_1.UpdateAdLimitDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateAdLimit", null);
__decorate([
    (0, common_1.Get)('listings/pending'),
    __param(0, (0, common_1.Query)('page', new common_1.DefaultValuePipe(1), common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(20), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPendingListings", null);
__decorate([
    (0, common_1.Patch)('listings/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "approveListing", null);
__decorate([
    (0, common_1.Patch)('listings/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reject_listing_dto_js_1.RejectListingDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "rejectListing", null);
__decorate([
    (0, common_1.Get)('analytics'),
    __param(0, (0, common_1.Query)('dateFrom')),
    __param(1, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getAnalytics", null);
__decorate([
    (0, common_1.Get)('analytics/export'),
    __param(0, (0, common_1.Query)('dateFrom')),
    __param(1, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "exportAnalytics", null);
__decorate([
    (0, common_1.Get)('packages/purchases'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_purchases_query_dto_js_1.ListPurchasesQueryDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPackagePurchases", null);
__decorate([
    (0, common_1.Get)('payments'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_payments_query_dto_js_1.ListPaymentsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPayments", null);
__decorate([
    (0, common_1.Get)('sellers/:id/ad-info'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSellerAdInfo", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('api/admin'),
    (0, common_1.UseGuards)(index_js_1.JwtAuthGuard, index_js_1.RolesGuard),
    (0, index_js_2.Roles)(user_schema_js_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_service_js_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map