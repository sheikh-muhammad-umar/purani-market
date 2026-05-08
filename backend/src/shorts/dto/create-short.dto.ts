import {
  IsOptional,
  IsString,
  MaxLength,
  IsMongoId,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ShortLocationDto {
  @IsOptional()
  @IsMongoId()
  provinceId?: string;

  @IsOptional()
  @IsMongoId()
  cityId?: string;

  @IsOptional()
  @IsMongoId()
  areaId?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  area?: string;
}

export class CreateShortDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShortLocationDto)
  location?: ShortLocationDto;

  @IsOptional()
  @IsMongoId()
  linkedListingId?: string;

  @IsOptional()
  @IsMongoId()
  purchaseId?: string;
}
