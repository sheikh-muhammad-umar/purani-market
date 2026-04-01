import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Connection } from 'mongoose';
export interface ListingDocument {
    _id: string;
    title: string;
    description: string;
    price: {
        amount: number;
        currency: string;
    };
    categoryId: string;
    categoryPath: string[];
    condition: string;
    categoryAttributes: Record<string, any>;
    location?: {
        type: string;
        coordinates: number[];
        city?: string;
        area?: string;
    };
    isFeatured: boolean;
    status: string;
    sellerId: string;
    createdAt: Date;
}
export declare class SearchSyncService implements OnModuleInit, OnModuleDestroy {
    private readonly connection;
    private readonly esService;
    private readonly logger;
    private changeStream;
    constructor(connection: Connection, esService: ElasticsearchService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    startChangeStream(): void;
    stopChangeStream(): Promise<void>;
    handleChange(change: any): Promise<void>;
    handleInsert(change: any): Promise<void>;
    handleUpdate(change: any): Promise<void>;
    handleDelete(change: any): Promise<void>;
    transformToEsDocument(doc: any): Record<string, any>;
    private transformCategoryAttributes;
    indexListing(doc: any): Promise<void>;
    removeListing(listingId: string): Promise<void>;
    buildFeaturedBoostQuery(baseQuery: any): any;
}
