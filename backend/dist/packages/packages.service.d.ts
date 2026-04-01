import { Model } from 'mongoose';
import { AdPackageDocument } from './schemas/ad-package.schema.js';
import { PackagePurchaseDocument } from './schemas/package-purchase.schema.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { ProductListingDocument } from '../listings/schemas/product-listing.schema.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PurchasePackageDto } from './dto/purchase-package.dto.js';
import { CreatePackageDto } from './dto/create-package.dto.js';
import { UpdatePackageDto } from './dto/update-package.dto.js';
export interface PurchaseResult {
    purchases: PackagePurchaseDocument[];
    redirectUrl: string;
    transactionId: string;
}
export interface AdLimitCheck {
    canPost: boolean;
    activeAdCount: number;
    adLimit: number;
    message?: string;
}
export declare class PackagesService {
    private readonly adPackageModel;
    private readonly packagePurchaseModel;
    private readonly userModel;
    private readonly listingModel;
    private readonly paymentsService;
    constructor(adPackageModel: Model<AdPackageDocument>, packagePurchaseModel: Model<PackagePurchaseDocument>, userModel: Model<UserDocument>, listingModel: Model<ProductListingDocument>, paymentsService: PaymentsService);
    createPackage(dto: CreatePackageDto): Promise<AdPackageDocument>;
    updatePackage(id: string, dto: UpdatePackageDto): Promise<AdPackageDocument>;
    findAll(): Promise<AdPackageDocument[]>;
    findById(id: string): Promise<AdPackageDocument>;
    getMyPurchases(sellerId: string): Promise<PackagePurchaseDocument[]>;
    purchasePackages(sellerId: string, dto: PurchasePackageDto): Promise<PurchaseResult>;
    handlePaymentCallback(payload: Record<string, any>): Promise<{
        status: string;
        message: string;
    }>;
    featureListing(listingId: string, sellerId: string): Promise<ProductListingDocument>;
    checkAdLimit(sellerId: string): Promise<AdLimitCheck>;
    handleExpiredFeaturedAds(): Promise<number>;
}
