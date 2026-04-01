import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
export type UserActivityDocument = HydratedDocument<UserActivity>;
export declare enum UserAction {
    VIEW = "view",
    SEARCH = "search",
    FAVORITE = "favorite",
    DISMISS = "dismiss",
    CONTACT = "contact"
}
export declare class UserActivity {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    action: UserAction;
    productListingId?: Types.ObjectId;
    searchQuery?: string;
    categoryId?: Types.ObjectId;
    metadata: Map<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserActivitySchema: MongooseSchema<UserActivity, import("mongoose").Model<UserActivity, any, any, any, (import("mongoose").Document<unknown, any, UserActivity, any, import("mongoose").DefaultSchemaOptions> & UserActivity & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, UserActivity, any, import("mongoose").DefaultSchemaOptions> & UserActivity & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, UserActivity>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    action?: import("mongoose").SchemaDefinitionProperty<UserAction, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    productListingId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    searchQuery?: import("mongoose").SchemaDefinitionProperty<string | undefined, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    metadata?: import("mongoose").SchemaDefinitionProperty<Map<string, any>, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, UserActivity, import("mongoose").Document<unknown, {}, UserActivity, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<UserActivity & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, UserActivity>;
