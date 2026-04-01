"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const product_listing_schema_js_1 = require("./schemas/product-listing.schema.js");
const listings_service_js_1 = require("./listings.service.js");
const listings_controller_js_1 = require("./listings.controller.js");
const media_service_js_1 = require("./media.service.js");
const storage_service_js_1 = require("./storage.service.js");
const users_module_js_1 = require("../users/users.module.js");
const categories_module_js_1 = require("../categories/categories.module.js");
const packages_module_js_1 = require("../packages/packages.module.js");
const search_module_js_1 = require("../search/search.module.js");
let ListingsModule = class ListingsModule {
};
exports.ListingsModule = ListingsModule;
exports.ListingsModule = ListingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: product_listing_schema_js_1.ProductListing.name, schema: product_listing_schema_js_1.ProductListingSchema },
            ]),
            users_module_js_1.UsersModule,
            categories_module_js_1.CategoriesModule,
            (0, common_1.forwardRef)(() => packages_module_js_1.PackagesModule),
            search_module_js_1.SearchModule,
        ],
        controllers: [listings_controller_js_1.ListingsController],
        providers: [listings_service_js_1.ListingsService, media_service_js_1.MediaService, storage_service_js_1.StorageService],
        exports: [listings_service_js_1.ListingsService, media_service_js_1.MediaService, mongoose_1.MongooseModule],
    })
], ListingsModule);
//# sourceMappingURL=listings.module.js.map