import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdPackageType } from '../schemas/ad-package.schema.js';

export class CategoryPricingDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(AdPackageType)
  type!: AdPackageType;

  @IsNumber()
  @IsEnum([7, 15, 30])
  duration!: number;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  defaultPrice!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryPricingDto)
  categoryPricing?: CategoryPricingDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
