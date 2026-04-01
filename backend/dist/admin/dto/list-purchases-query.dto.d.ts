import { AdPackageType } from '../../packages/schemas/ad-package.schema.js';
import { PaymentStatus } from '../../packages/schemas/package-purchase.schema.js';
export declare class ListPurchasesQueryDto {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
    type?: AdPackageType;
    status?: PaymentStatus;
}
