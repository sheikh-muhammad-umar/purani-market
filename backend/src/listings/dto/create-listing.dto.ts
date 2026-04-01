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
  ArrayMinSize,
  IsObject,
  Min,
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
  @IsArray()
  @ArrayMinSize(2)
  @IsNumber({}, { each: true })
  coordinates!: number[];

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  area?: string;
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

  @IsEnum(ListingCondition)
  condition!: ListingCondition;

  @IsObject()
  @IsOptional()
  categoryAttributes?: Record<string, any>;

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
}
