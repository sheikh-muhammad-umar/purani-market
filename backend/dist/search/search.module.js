"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const elasticsearch_1 = require("@nestjs/elasticsearch");
const config_1 = require("@nestjs/config");
const categories_module_js_1 = require("../categories/categories.module.js");
const product_listing_schema_js_1 = require("../listings/schemas/product-listing.schema.js");
const search_index_service_js_1 = require("./search-index.service.js");
const search_sync_service_js_1 = require("./search-sync.service.js");
const search_service_js_1 = require("./search.service.js");
const search_controller_js_1 = require("./search.controller.js");
let SearchModule = class SearchModule {
};
exports.SearchModule = SearchModule;
exports.SearchModule = SearchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([{ name: product_listing_schema_js_1.ProductListing.name, schema: product_listing_schema_js_1.ProductListingSchema }]),
            elasticsearch_1.ElasticsearchModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const username = configService.get('elasticsearch.username');
                    const password = configService.get('elasticsearch.password');
                    return {
                        node: configService.get('elasticsearch.node') || 'http://localhost:9200',
                        ...(username && password ? { auth: { username, password } } : {}),
                    };
                },
            }),
            categories_module_js_1.CategoriesModule,
        ],
        controllers: [search_controller_js_1.SearchController],
        providers: [search_index_service_js_1.SearchIndexService, search_sync_service_js_1.SearchSyncService, search_service_js_1.SearchService],
        exports: [search_index_service_js_1.SearchIndexService, search_sync_service_js_1.SearchSyncService, search_service_js_1.SearchService],
    })
], SearchModule);
//# sourceMappingURL=search.module.js.map