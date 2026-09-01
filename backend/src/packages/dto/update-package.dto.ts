import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  ValidateNested,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdPackageType } from '../schemas/ad-package.schema.js';
import {
  CategoryPricingDto,
  EntitlementDto,
  IsAllowedDurationConstraint,
} from './create-package.dto.js';

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AdPackageType)
  type?: AdPackageType;

  @IsOptional()
  @IsNumber()
  @Validate(IsAllowedDurationConstraint)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  /**
   * Replaces the entitlement list outright; `type` and `quantity` are re-derived
   * from it. Send `[]` to fall back to the legacy `type` + `quantity` form.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntitlementDto)
  entitlements?: EntitlementDto[];

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
