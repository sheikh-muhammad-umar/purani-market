import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
export type ProductListingDocument = HydratedDocument<ProductListing>;
export declare enum ListingCondition {
    NEW = "new",
    USED = "used",
    REFURBISHED = "refurbished"
}
export declare enum ListingStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    PENDING_REVIEW = "pending_review",
    REJECTED = "rejected",
    SOLD = "sold",
    RESERVED = "reserved",
    DELETED = "deleted"
}
export declare class ListingPrice {
    amount: number;
    currency: string;
}
export declare class ListingImage {
    url: string;
    thumbnailUrl?: string;
    sortOrder: number;
}
export declare class ListingVideo {
    url: string;
    thumbnailUrl?: string;
}
export declare class ListingLocation {
    type: string;
    coordinates: number[];
    city?: string;
    area?: string;
}
export declare class ListingContactInfo {
    phone?: string;
    email?: string;
}
export declare class ProductListing {
    _id: Types.ObjectId;
    sellerId: Types.ObjectId;
    title: string;
    description: string;
    price: ListingPrice;
    categoryId: Types.ObjectId;
    categoryPath: Types.ObjectId[];
    condition: ListingCondition;
    categoryAttributes: Map<string, any>;
    images: ListingImage[];
    video?: ListingVideo;
    location?: ListingLocation;
    contactInfo?: ListingContactInfo;
    status: ListingStatus;
    isFeatured: boolean;
    featuredUntil?: Date;
    rejectionReason?: string;
    viewCount: number;
    favoriteCount: number;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ProductListingSchema: MongooseSchema<ProductListing, import("mongoose").Model<ProductListing, any, any, any, (import("mongoose").Document<unknown, any, ProductListing, any, import("mongoose").DefaultSchemaOptions> & ProductListing & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, ProductListing, any, import("mongoose").DefaultSchemaOptions> & ProductListing & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, ProductListing>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    sellerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    title?: import("mongoose").SchemaDefinitionProperty<string, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<ListingPrice, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryPath?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId[], ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    condition?: import("mongoose").SchemaDefinitionProperty<ListingCondition, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryAttributes?: import("mongoose").SchemaDefinitionProperty<Map<string, any>, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    images?: import("mongoose").SchemaDefinitionProperty<ListingImage[], ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    video?: import("mongoose").SchemaDefinitionProperty<ListingVideo | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    location?: import("mongoose").SchemaDefinitionProperty<ListingLocation | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contactInfo?: import("mongoose").SchemaDefinitionProperty<ListingContactInfo | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<ListingStatus, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isFeatured?: import("mongoose").SchemaDefinitionProperty<boolean, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    featuredUntil?: import("mongoose").SchemaDefinitionProperty<Date | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    rejectionReason?: import("mongoose").SchemaDefinitionProperty<string | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    viewCount?: import("mongoose").SchemaDefinitionProperty<number, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    favoriteCount?: import("mongoose").SchemaDefinitionProperty<number, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    deletedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, ProductListing, import("mongoose").Document<unknown, {}, ProductListing, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ProductListing & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, ProductListing>;
