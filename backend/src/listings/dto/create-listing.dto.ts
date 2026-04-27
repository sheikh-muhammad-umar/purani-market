import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsPositive,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
  IsMongoId,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingCondition } from '../schemas/product-listing.schema.js';

export class CreateListingPriceDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class CreateListingImageDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateListingVideoDto {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}

export class CreateListingLocationDto {
  @IsString()
  @IsOptional()
  provinceId?: string;

  @IsString()
  @IsOptional()
  cityId?: string;

  @IsString()
  @IsOptional()
  areaId?: string;

  @IsString()
  @IsOptional()
  blockPhase?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @Matches(
    /^https:\/\/(www\.)?(google\.[a-z.]+\/(maps|maps\/place|maps\/dir|maps\/search|maps\/@)|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com)/,
    {
      message:
        'mapLink must be a valid Google Maps or Apple Maps URL (https only)',
    },
  )
  mapLink?: string;
}

export class CreateListingContactInfoDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @ValidateNested()
  @Type(() => CreateListingPriceDto)
  price!: CreateListingPriceDto;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryPath?: string[];

  @IsEnum(ListingCondition)
  condition!: ListingCondition;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  vehicleBrandId?: string;

  @IsOptional()
  @IsString()
  vehicleBrandName?: string;

  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  variantName?: string;

  @IsObject()
  @IsOptional()
  categoryAttributes?: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedFeatures?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateListingImageDto)
  @IsOptional()
  images?: CreateListingImageDto[];

  @ValidateNested()
  @Type(() => CreateListingVideoDto)
  @IsOptional()
  video?: CreateListingVideoDto;

  @ValidateNested()
  @Type(() => CreateListingLocationDto)
  location!: CreateListingLocationDto;

  @ValidateNested()
  @Type(() => CreateListingContactInfoDto)
  @IsOptional()
  contactInfo?: CreateListingContactInfoDto;

  @IsOptional()
  isFeatured?: boolean;

  @IsOptional()
  @IsMongoId()
  purchaseId?: string;
}
