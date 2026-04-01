import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdPackageType } from '../../packages/schemas/ad-package.schema.js';
import { PaymentStatus } from '../../packages/schemas/package-purchase.schema.js';

export class ListPurchasesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsEnum(AdPackageType)
  type?: AdPackageType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
