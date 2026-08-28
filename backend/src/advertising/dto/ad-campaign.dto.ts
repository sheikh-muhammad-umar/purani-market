import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AdCampaignStatus,
  AdDevice,
  AdPlacement,
  AdPricingModel,
} from '../advertising.enums.js';

export class AdTargetingDto {
  /** At least one placement, otherwise the campaign has nowhere to run. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsEnum(AdPlacement, { each: true })
  placements!: AdPlacement[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  provinceIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsMongoId({ each: true })
  cityIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsEnum(AdDevice, { each: true })
  devices?: AdDevice[];
}

export class CreateAdCampaignDto {
  @IsMongoId()
  advertiserId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(AdCampaignStatus)
  status?: AdCampaignStatus;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsEnum(AdPricingModel)
  pricingModel?: AdPricingModel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxImpressions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxClicks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyImpressionCap?: number;

  @ValidateNested()
  @Type(() => AdTargetingDto)
  targeting!: AdTargetingDto;
}

export class UpdateAdCampaignDto {
  @IsOptional()
  @IsMongoId()
  advertiserId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(AdCampaignStatus)
  status?: AdCampaignStatus;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsEnum(AdPricingModel)
  pricingModel?: AdPricingModel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxImpressions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxClicks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyImpressionCap?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdTargetingDto)
  targeting?: AdTargetingDto;
}
