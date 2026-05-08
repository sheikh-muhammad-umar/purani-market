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
import { ShortLocationDto } from './create-short.dto.js';

export class UpdateShortDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShortLocationDto)
  location?: ShortLocationDto;

  @IsOptional()
  @IsMongoId()
  linkedListingId?: string;
}
