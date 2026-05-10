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
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdPackageType } from '../schemas/ad-package.schema.js';
import { getPackageDurations } from '../constants/package-durations.js';

@ValidatorConstraint({ name: 'isAllowedDuration', async: false })
export class IsAllowedDurationConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return getPackageDurations().includes(value);
  }

  defaultMessage(): string {
    return `duration must be one of: ${getPackageDurations().join(', ')}`;
  }
}

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
  @Validate(IsAllowedDurationConstraint)
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
