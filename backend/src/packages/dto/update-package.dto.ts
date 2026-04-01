import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdPackageType } from '../schemas/ad-package.schema.js';
import { CategoryPricingDto } from './create-package.dto.js';

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AdPackageType)
  type?: AdPackageType;

  @IsOptional()
  @IsNumber()
  @IsEnum([7, 15, 30])
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryPricingDto)
  categoryPricing?: CategoryPricingDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
