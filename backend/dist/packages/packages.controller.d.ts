import { PackagesService } from './packages.service.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';
export declare class PackagesController {
    private readonly packagesService;
    constructor(packagesService: PackagesService);
    findAll(): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/ad-package.schema.js").AdPackage, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/ad-package.schema.js").AdPackage & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    getMyPurchases(sellerId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/package-purchase.schema.js").PackagePurchase, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/package-purchase.schema.js").PackagePurchase & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
    findById(id: string): Promise<import("mongoose").Document<unknown, {}, import("./schemas/ad-package.schema.js").AdPackage, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/ad-package.schema.js").AdPackage & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    createPackage(dto: CreatePackageDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/ad-package.schema.js").AdPackage, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/ad-package.schema.js").AdPackage & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    updatePackage(id: string, dto: UpdatePackageDto): Promise<import("mongoose").Document<unknown, {}, import("./schemas/ad-package.schema.js").AdPackage, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/ad-package.schema.js").AdPackage & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    purchasePackages(sellerId: string, dto: PurchasePackageDto): Promise<import("./packages.service.js").PurchaseResult>;
    paymentCallback(payload: Record<string, any>): Promise<{
        status: string;
        message: string;
    }>;
}
