import { PaymentMethod } from '../schemas/package-purchase.schema.js';
export declare class PurchaseItemDto {
    packageId: string;
    categoryId?: string;
}
export declare class PurchasePackageDto {
    items: PurchaseItemDto[];
    paymentMethod: PaymentMethod;
}
