import { PackagePurchaseDocument } from '../schemas/package-purchase.schema.js';

export interface PurchaseResult {
  purchases: PackagePurchaseDocument[];
  redirectUrl: string;
  transactionId: string;
}
