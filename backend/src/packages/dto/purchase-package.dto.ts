import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../schemas/package-purchase.schema.js';

export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class PurchasePackageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
