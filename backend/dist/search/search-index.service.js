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
var SearchIndexService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndexService = exports.listingsIndexMapping = exports.FEATURED_BOOST_FACTOR = exports.LISTINGS_INDEX = void 0;
const common_1 = require("@nestjs/common");
const elasticsearch_1 = require("@nestjs/elasticsearch");
exports.LISTINGS_INDEX = 'product_listings';
exports.FEATURED_BOOST_FACTOR = 5;
exports.listingsIndexMapping = {
    properties: {
        title: { type: 'text', analyzer: 'standard' },
        description: { type: 'text', analyzer: 'standard' },
        'price.amount': { type: 'float' },
        'price.currency': { type: 'keyword' },
        categoryId: { type: 'keyword' },
        categoryPath: { type: 'keyword' },
        condition: { type: 'keyword' },
        categoryAttributes: { type: 'object', enabled: true },
        location: { type: 'geo_point' },
        isFeatured: { type: 'boolean' },
        status: { type: 'keyword' },
        sellerId: { type: 'keyword' },
        createdAt: { type: 'date' },
    },
};
let SearchIndexService = SearchIndexService_1 = class SearchIndexService {
    esService;
    logger = new common_1.Logger(SearchIndexService_1.name);
    constructor(esService) {
        this.esService = esService;
    }
    async onModuleInit() {
        await this.ensureIndex();
    }
    async ensureIndex() {
        try {
            const exists = await this.esService.indices.exists({
                index: exports.LISTINGS_INDEX,
            });
            if (!exists) {
                await this.createIndex();
                this.logger.log(`Created Elasticsearch index: ${exports.LISTINGS_INDEX}`);
            }
            else {
                this.logger.log(`Elasticsearch index already exists: ${exports.LISTINGS_INDEX}`);
            }
        }
        catch (error) {
            this.logger.warn(`Elasticsearch unavailable — search features disabled. ${error.message}`);
        }
    }
    async createIndex() {
        await this.esService.indices.create({
            index: exports.LISTINGS_INDEX,
            mappings: exports.listingsIndexMapping,
        });
    }
    async deleteIndex() {
        const exists = await this.esService.indices.exists({
            index: exports.LISTINGS_INDEX,
        });
        if (exists) {
            await this.esService.indices.delete({ index: exports.LISTINGS_INDEX });
            this.logger.log(`Deleted Elasticsearch index: ${exports.LISTINGS_INDEX}`);
        }
    }
};
exports.SearchIndexService = SearchIndexService;
exports.SearchIndexService = SearchIndexService = SearchIndexService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [elasticsearch_1.ElasticsearchService])
], SearchIndexService);
//# sourceMappingURL=search-index.service.js.map