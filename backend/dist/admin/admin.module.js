"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const admin_controller_js_1 = require("./admin.controller.js");
const admin_service_js_1 = require("./admin.service.js");
const users_module_js_1 = require("../users/users.module.js");
const auth_module_js_1 = require("../auth/auth.module.js");
const listings_module_js_1 = require("../listings/listings.module.js");
const messaging_module_js_1 = require("../messaging/messaging.module.js");
const notifications_module_js_1 = require("../notifications/notifications.module.js");
const categories_module_js_1 = require("../categories/categories.module.js");
const review_schema_js_1 = require("../reviews/schemas/review.schema.js");
const package_purchase_schema_js_1 = require("../packages/schemas/package-purchase.schema.js");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            users_module_js_1.UsersModule,
            auth_module_js_1.AuthModule,
            listings_module_js_1.ListingsModule,
            messaging_module_js_1.MessagingModule,
            notifications_module_js_1.NotificationsModule,
            categories_module_js_1.CategoriesModule,
            mongoose_1.MongooseModule.forFeature([
                { name: review_schema_js_1.Review.name, schema: review_schema_js_1.ReviewSchema },
                { name: package_purchase_schema_js_1.PackagePurchase.name, schema: package_purchase_schema_js_1.PackagePurchaseSchema },
            ]),
        ],
        controllers: [admin_controller_js_1.AdminController],
        providers: [admin_service_js_1.AdminService],
        exports: [admin_service_js_1.AdminService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map