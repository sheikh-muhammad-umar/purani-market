import { HydratedDocument, Types } from 'mongoose';
import { AdPackageType } from './ad-package.schema.js';
export type PackagePurchaseDocument = HydratedDocument<PackagePurchase>;
export declare enum PaymentMethod {
    JAZZCASH = "jazzcash",
    EASYPAISA = "easypaisa",
    CARD = "card"
}
export declare enum PaymentStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    FAILED = "failed",
    REFUNDED = "refunded"
}
export declare class PackagePurchase {
    _id: Types.ObjectId;
    sellerId: Types.ObjectId;
    packageId: Types.ObjectId;
    categoryId?: Types.ObjectId;
    type: AdPackageType;
    quantity: number;
    remainingQuantity: number;
    duration: number;
    price: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentTransactionId?: string;
    activatedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PackagePurchaseSchema: import("mongoose").Schema<PackagePurchase, import("mongoose").Model<PackagePurchase, any, any, any, (import("mongoose").Document<unknown, any, PackagePurchase, any, import("mongoose").DefaultSchemaOptions> & PackagePurchase & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, PackagePurchase, any, import("mongoose").DefaultSchemaOptions> & PackagePurchase & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}), any, PackagePurchase>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    sellerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    packageId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    categoryId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<AdPackageType, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    quantity?: import("mongoose").SchemaDefinitionProperty<number, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    remainingQuantity?: import("mongoose").SchemaDefinitionProperty<number, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    duration?: import("mongoose").SchemaDefinitionProperty<number, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<number, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paymentMethod?: import("mongoose").SchemaDefinitionProperty<PaymentMethod, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paymentStatus?: import("mongoose").SchemaDefinitionProperty<PaymentStatus, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paymentTransactionId?: import("mongoose").SchemaDefinitionProperty<string | undefined, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    activatedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, PackagePurchase, import("mongoose").Document<unknown, {}, PackagePurchase, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PackagePurchase & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PackagePurchase>;
