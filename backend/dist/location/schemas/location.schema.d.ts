import { HydratedDocument, Types } from 'mongoose';
export type LocationDocument = HydratedDocument<Location>;
export declare enum LocationLevel {
    PROVINCE = "province",
    CITY = "city",
    AREA = "area",
    SUBAREA = "subarea",
    BLOCK = "block"
}
export declare class Location {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    level: LocationLevel;
    parentId: Types.ObjectId | null;
    hierarchyPath: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const LocationSchema: import("mongoose").Schema<Location, import("mongoose").Model<Location, any, any, any, (import("mongoose").Document<unknown, any, Location, any, import("mongoose").DefaultSchemaOptions> & Location & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, Location, any, import("mongoose").DefaultSchemaOptions> & Location & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, Location>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Location, import("mongoose").Document<unknown, {}, Location, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    slug?: import("mongoose").SchemaDefinitionProperty<string, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    level?: import("mongoose").SchemaDefinitionProperty<LocationLevel, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    parentId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    hierarchyPath?: import("mongoose").SchemaDefinitionProperty<string, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    sortOrder?: import("mongoose").SchemaDefinitionProperty<number, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, Location, import("mongoose").Document<unknown, {}, Location, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Location & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Location>;
