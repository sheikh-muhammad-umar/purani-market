import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  IsPositive,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingCondition } from '../schemas/product-listing.schema.js';
import {
  CreateListingPriceDto,
  CreateListingImageDto,
  CreateListingVideoDto,
  CreateListingLocationDto,
  CreateListingContactInfoDto,
} from './create-listing.dto.js';

export class UpdateListingDto {
  @IsString()
  @MaxLength(150)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => CreateListingPriceDto)
  @IsOptional()
  price?: CreateListingPriceDto;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryPath?: string[];

  @IsEnum(ListingCondition)
  @IsOptional()
  condition?: ListingCondition;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

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
  @IsOptional()
  location?: CreateListingLocationDto;

  @ValidateNested()
  @Type(() => CreateListingContactInfoDto)
  @IsOptional()
  contactInfo?: CreateListingContactInfoDto;
}
