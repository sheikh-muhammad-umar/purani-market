import { HydratedDocument, Types } from 'mongoose';
export type PakistanLocationDocument = HydratedDocument<PakistanLocation>;
export declare enum LocationLevel {
    PROVINCE = "province",
    CITY = "city",
    AREA = "area",
    SUBAREA = "subarea",
    BLOCK = "block"
}
export declare class PakistanLocation {
    _id: Types.ObjectId;
    name: string;
    level: LocationLevel;
    parentId: Types.ObjectId | null;
    hierarchyPath: string;
    isActive: boolean;
    sortOrder: number;
}
export declare const PakistanLocationSchema: import("mongoose").Schema<PakistanLocation, import("mongoose").Model<PakistanLocation, any, any, any, (import("mongoose").Document<unknown, any, PakistanLocation, any, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, PakistanLocation, any, import("mongoose").DefaultSchemaOptions> & PakistanLocation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, PakistanLocation>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    level?: import("mongoose").SchemaDefinitionProperty<LocationLevel, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    parentId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | null, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    hierarchyPath?: import("mongoose").SchemaDefinitionProperty<string, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    sortOrder?: import("mongoose").SchemaDefinitionProperty<number, PakistanLocation, import("mongoose").Document<unknown, {}, PakistanLocation, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PakistanLocation & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PakistanLocation>;
