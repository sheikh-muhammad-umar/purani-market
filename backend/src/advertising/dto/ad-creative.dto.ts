import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdPlacement } from '../advertising.enums.js';

export class CreateAdCreativeDto {
  @IsMongoId()
  campaignId!: string;

  @IsEnum(AdPlacement)
  placement!: AdPlacement;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  body?: string;

  @IsUrl({ require_protocol: true })
  imageUrl!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  mobileImageUrl?: string;

  /** Required: a decorative-only ad would be unreadable to screen readers. */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  altText!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  routeLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAdCreativeDto {
  @IsOptional()
  @IsEnum(AdPlacement)
  placement?: AdPlacement;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  body?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  mobileImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  altText?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  routeLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
