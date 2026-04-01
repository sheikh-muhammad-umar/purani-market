import { HydratedDocument, Types } from 'mongoose';
export type AdPackageDocument = HydratedDocument<AdPackage>;
export declare enum AdPackageType {
    FEATURED_ADS = "featured_ads",
    AD_SLOTS = "ad_slots"
}
export declare class CategoryPricing {
    categoryId: Types.ObjectId;
    price: number;
}
export declare class AdPackage {
    _id: Types.ObjectId;
    name: string;
    type: AdPackageType;
    duration: number;
    quantity: number;
    defaultPrice: number;
    categoryPricing: CategoryPricing[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AdPackageSchema: import("mongoose").Schema<AdPackage, import("mongoose").Model<AdPackage, any, any, any, (import("mongoose").Document<unknown, any, AdPackage, any, import("mongoose").DefaultSchemaOptions> & AdPackage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, AdPackage, any, import("mongoose").DefaultSchemaOptions> & AdPackage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, AdPackage>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<AdPackageType, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    duration?: import("mongoose").SchemaDefinitionProperty<number, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    quantity?: import("mongoose").SchemaDefinitionProperty<number, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    defaultPrice?: import("mongoose").SchemaDefinitionProperty<number, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryPricing?: import("mongoose").SchemaDefinitionProperty<CategoryPricing[], AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, AdPackage, import("mongoose").Document<unknown, {}, AdPackage, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<AdPackage & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, AdPackage>;
