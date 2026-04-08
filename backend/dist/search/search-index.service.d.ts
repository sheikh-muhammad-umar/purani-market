import { OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
export declare const LISTINGS_INDEX = "product_listings";
export declare const FEATURED_BOOST_FACTOR = 5;
export declare const listingsIndexMapping: {
    properties: {
        title: {
            type: "text";
            analyzer: string;
            fields: {
                keyword: {
                    type: "keyword";
                    ignore_above: number;
                };
            };
        };
        description: {
            type: "text";
            analyzer: string;
        };
        'price.amount': {
            type: "float";
        };
        'price.currency': {
            type: "keyword";
        };
        categoryId: {
            type: "keyword";
        };
        categoryPath: {
            type: "keyword";
        };
        condition: {
            type: "keyword";
        };
        categoryAttributes: {
            type: "object";
            enabled: boolean;
        };
        location: {
            type: "geo_point";
        };
        isFeatured: {
            type: "boolean";
        };
        status: {
            type: "keyword";
        };
        sellerId: {
            type: "keyword";
        };
        createdAt: {
            type: "date";
        };
    };
};
export declare class SearchIndexService implements OnModuleInit {
    private readonly esService;
    private readonly logger;
    constructor(esService: ElasticsearchService);
    onModuleInit(): Promise<void>;
    ensureIndex(): Promise<void>;
    createIndex(): Promise<void>;
    deleteIndex(): Promise<void>;
}
