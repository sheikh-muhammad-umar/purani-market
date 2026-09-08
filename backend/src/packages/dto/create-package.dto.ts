import {
  ArrayMaxSize,
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
import { EntitlementKind } from '../entitlement.types.js';
import { getAllPackageDurations } from '../constants/package-durations.js';

/** One row per kind at most, so the cap is the number of kinds that exist. */
const ENTITLEMENT_KIND_COUNT = Object.keys(EntitlementKind).length;

/**
 * Rejects a duration no package of any kind is sold on.
 *
 * Deliberately the union of the single-purpose and bundle sets rather than the one
 * that applies to this request. A PATCH may send `duration` alone, leaving nothing
 * here to say whether the package being edited is a bundle, so narrowing it at
 * this layer would reject a legitimate 90-day edit to an existing all-in-one.
 * `PackagesService` applies the exact set once the resolved type is known.
 */
@ValidatorConstraint({ name: 'isAllowedDuration', async: false })
export class IsAllowedDurationConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return getAllPackageDurations().includes(value);
  }

  defaultMessage(): string {
    return `duration must be one of: ${getAllPackageDurations().join(', ')}`;
  }
}

export class EntitlementDto {
  @IsEnum(EntitlementKind)
  kind!: EntitlementKind;

  @IsNumber()
  @Min(1)
  quantity!: number;
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

  /**
   * Optional now. Supply `entitlements` instead and the type is derived — a single
   * entitlement keeps its historical type, anything broader becomes `bundle`.
   * Still accepted on its own so existing callers and single-purpose packages work
   * unchanged.
   */
  @IsOptional()
  @IsEnum(AdPackageType)
  type?: AdPackageType;

  @IsNumber()
  @Validate(IsAllowedDurationConstraint)
  duration!: number;

  /** Required only in the legacy `type` + `quantity` form. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  /**
   * What the package grants. One row makes an ordinary package, several make an
   * all-in-one bundle.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ENTITLEMENT_KIND_COUNT)
  @ValidateNested({ each: true })
  @Type(() => EntitlementDto)
  entitlements?: EntitlementDto[];

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
