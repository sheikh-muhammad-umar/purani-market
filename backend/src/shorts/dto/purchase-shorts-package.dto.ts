import { IsMongoId, IsString, IsOptional } from 'class-validator';

export class PurchaseShortsPackageDto {
  @IsMongoId()
  packageId!: string;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
