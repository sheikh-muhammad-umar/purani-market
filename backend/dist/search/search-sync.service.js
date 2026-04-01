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
var SearchSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchSyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const elasticsearch_1 = require("@nestjs/elasticsearch");
const mongoose_2 = require("mongoose");
const search_index_service_js_1 = require("./search-index.service.js");
let SearchSyncService = SearchSyncService_1 = class SearchSyncService {
    connection;
    esService;
    logger = new common_1.Logger(SearchSyncService_1.name);
    changeStream;
    constructor(connection, esService) {
        this.connection = connection;
        this.esService = esService;
    }
    async onModuleInit() {
        this.startChangeStream();
    }
    async onModuleDestroy() {
        await this.stopChangeStream();
    }
    startChangeStream() {
        try {
            const collection = this.connection.collection('product_listings');
            this.changeStream = collection.watch([], { fullDocument: 'updateLookup' });
            this.changeStream.on('change', async (change) => {
                try {
                    await this.handleChange(change);
                }
                catch (error) {
                    this.logger.error(`Error processing change stream event: ${error.message}`);
                }
            });
            this.changeStream.on('error', (error) => {
                if (error.message?.includes('replica set') || error.message?.includes('$changeStream')) {
                    this.logger.warn('Change streams require a replica set — skipping real-time sync. Listings will not auto-sync to Elasticsearch.');
                    this.stopChangeStream();
                    return;
                }
                this.logger.error(`Change stream error: ${error.message}`);
            });
            this.logger.log('MongoDB change stream started for product_listings');
        }
        catch (error) {
            const msg = error.message || '';
            if (msg.includes('replica set') || msg.includes('$changeStream')) {
                this.logger.warn('Change streams not supported (standalone MongoDB) — skipping real-time ES sync.');
            }
            else {
                this.logger.error(`Failed to start change stream: ${msg}`);
            }
        }
    }
    async stopChangeStream() {
        if (this.changeStream) {
            await this.changeStream.close();
            this.changeStream = null;
            this.logger.log('MongoDB change stream stopped');
        }
    }
    async handleChange(change) {
        switch (change.operationType) {
            case 'insert':
                await this.handleInsert(change);
                break;
            case 'update':
            case 'replace':
                await this.handleUpdate(change);
                break;
            case 'delete':
                await this.handleDelete(change);
                break;
            default:
                this.logger.debug(`Unhandled change type: ${change.operationType}`);
        }
    }
    async handleInsert(change) {
        const doc = change.fullDocument;
        if (!doc)
            return;
        const esDoc = this.transformToEsDocument(doc);
        await this.esService.index({
            index: search_index_service_js_1.LISTINGS_INDEX,
            id: doc._id.toString(),
            document: esDoc,
        });
        this.logger.debug(`Indexed listing: ${doc._id}`);
    }
    async handleUpdate(change) {
        const doc = change.fullDocument;
        if (!doc)
            return;
        const esDoc = this.transformToEsDocument(doc);
        await this.esService.index({
            index: search_index_service_js_1.LISTINGS_INDEX,
            id: doc._id.toString(),
            document: esDoc,
        });
        this.logger.debug(`Updated listing in index: ${doc._id}`);
    }
    async handleDelete(change) {
        const docId = change.documentKey._id.toString();
        try {
            await this.esService.delete({
                index: search_index_service_js_1.LISTINGS_INDEX,
                id: docId,
            });
            this.logger.debug(`Deleted listing from index: ${docId}`);
        }
        catch (error) {
            if (error?.meta?.statusCode === 404) {
                this.logger.debug(`Listing not found in index for deletion: ${docId}`);
            }
            else {
                throw error;
            }
        }
    }
    transformToEsDocument(doc) {
        const esDoc = {
            title: doc.title,
            description: doc.description,
            price: {
                amount: doc.price?.amount,
                currency: doc.price?.currency || 'PKR',
            },
            categoryId: doc.categoryId?.toString(),
            categoryPath: (doc.categoryPath || []).map((id) => id.toString()),
            condition: doc.condition,
            categoryAttributes: this.transformCategoryAttributes(doc.categoryAttributes),
            isFeatured: doc.isFeatured || false,
            status: doc.status,
            sellerId: doc.sellerId?.toString(),
            createdAt: doc.createdAt,
        };
        if (doc.location?.coordinates?.length === 2) {
            esDoc.location = {
                lat: doc.location.coordinates[1],
                lon: doc.location.coordinates[0],
            };
        }
        return esDoc;
    }
    transformCategoryAttributes(attrs) {
        if (!attrs)
            return {};
        if (attrs instanceof Map) {
            const result = {};
            attrs.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        if (typeof attrs === 'object') {
            return { ...attrs };
        }
        return {};
    }
    async indexListing(doc) {
        const esDoc = this.transformToEsDocument(doc);
        await this.esService.index({
            index: search_index_service_js_1.LISTINGS_INDEX,
            id: doc._id.toString(),
            document: esDoc,
        });
    }
    async removeListing(listingId) {
        try {
            await this.esService.delete({ index: search_index_service_js_1.LISTINGS_INDEX, id: listingId });
        }
        catch (error) {
            if (error?.meta?.statusCode !== 404)
                throw error;
        }
    }
    buildFeaturedBoostQuery(baseQuery) {
        return {
            function_score: {
                query: baseQuery,
                functions: [
                    {
                        filter: { term: { isFeatured: true } },
                        weight: search_index_service_js_1.FEATURED_BOOST_FACTOR,
                    },
                ],
                boost_mode: 'multiply',
                score_mode: 'sum',
            },
        };
    }
};
exports.SearchSyncService = SearchSyncService;
exports.SearchSyncService = SearchSyncService = SearchSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection,
        elasticsearch_1.ElasticsearchService])
], SearchSyncService);
//# sourceMappingURL=search-sync.service.js.map