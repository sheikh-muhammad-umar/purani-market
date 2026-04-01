import { HydratedDocument, Types } from 'mongoose';
export type FavoriteDocument = HydratedDocument<Favorite>;
export declare class Favorite {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    productListingId: Types.ObjectId;
    createdAt: Date;
}
export declare const FavoriteSchema: import("mongoose").Schema<Favorite, import("mongoose").Model<Favorite, any, any, any, (import("mongoose").Document<unknown, any, Favorite, any, import("mongoose").DefaultSchemaOptions> & Favorite & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, Favorite, any, import("mongoose").DefaultSchemaOptions> & Favorite & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, Favorite>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Favorite, import("mongoose").Document<unknown, {}, Favorite, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Favorite & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Favorite, import("mongoose").Document<unknown, {}, Favorite, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Favorite & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Favorite, import("mongoose").Document<unknown, {}, Favorite, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Favorite & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    productListingId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Favorite, import("mongoose").Document<unknown, {}, Favorite, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Favorite & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, Favorite, import("mongoose").Document<unknown, {}, Favorite, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Favorite & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Favorite>;
