import { IsMongoId, IsEnum } from 'class-validator';
import { PaymentMethod } from '../../packages/schemas/package-purchase.schema.js';

export class PurchaseShortsPackageDto {
  @IsMongoId()
  packageId!: string;

  /**
   * Checked against the enum here so an unknown method is refused at the edge
   * with a 400. As a bare string it reached mongoose, which enforces the same
   * enum and answered with a validation error surfacing as a 500.
   */
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  // No `transactionId`. It was accepted from the request and stored as the
  // purchase's payment reference, which is the field `handlePaymentCallback`
  // matches on — so a seller could submit one matching a pending gateway
  // transaction and have that callback activate this package for free. The
  // reference is now derived from the purchase id on the server. The global
  // validation pipe forbids non-whitelisted properties, so sending one is
  // refused rather than quietly ignored.
}
