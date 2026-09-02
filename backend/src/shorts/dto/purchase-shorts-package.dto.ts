import { IsMongoId, IsString, IsOptional, IsEnum } from 'class-validator';
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

  @IsOptional()
  @IsString()
  transactionId?: string;
}
