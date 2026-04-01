"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackagesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const ad_package_schema_js_1 = require("./schemas/ad-package.schema.js");
const package_purchase_schema_js_1 = require("./schemas/package-purchase.schema.js");
const packages_service_js_1 = require("./packages.service.js");
const packages_controller_js_1 = require("./packages.controller.js");
const payments_module_js_1 = require("../payments/payments.module.js");
const users_module_js_1 = require("../users/users.module.js");
const listings_module_js_1 = require("../listings/listings.module.js");
let PackagesModule = class PackagesModule {
};
exports.PackagesModule = PackagesModule;
exports.PackagesModule = PackagesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            mongoose_1.MongooseModule.forFeature([
                { name: ad_package_schema_js_1.AdPackage.name, schema: ad_package_schema_js_1.AdPackageSchema },
                { name: package_purchase_schema_js_1.PackagePurchase.name, schema: package_purchase_schema_js_1.PackagePurchaseSchema },
            ]),
            payments_module_js_1.PaymentsModule,
            users_module_js_1.UsersModule,
            (0, common_1.forwardRef)(() => listings_module_js_1.ListingsModule),
        ],
        controllers: [packages_controller_js_1.PackagesController],
        providers: [packages_service_js_1.PackagesService],
        exports: [packages_service_js_1.PackagesService],
    })
], PackagesModule);
//# sourceMappingURL=packages.module.js.map