import { HydratedDocument, Types } from 'mongoose';
export type VerificationTokenDocument = HydratedDocument<VerificationToken>;
export declare enum VerificationType {
    EMAIL = "email",
    PHONE = "phone",
    PASSWORD_RESET = "password_reset"
}
export declare class VerificationToken {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    type: VerificationType;
    token: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const VerificationTokenSchema: import("mongoose").Schema<VerificationToken, import("mongoose").Model<VerificationToken, any, any, any, (import("mongoose").Document<unknown, any, VerificationToken, any, import("mongoose").DefaultSchemaOptions> & VerificationToken & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, VerificationToken, any, import("mongoose").DefaultSchemaOptions> & VerificationToken & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, VerificationToken>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<VerificationType, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    token?: import("mongoose").SchemaDefinitionProperty<string, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    used?: import("mongoose").SchemaDefinitionProperty<boolean, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, VerificationToken, import("mongoose").Document<unknown, {}, VerificationToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<VerificationToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, VerificationToken>;
