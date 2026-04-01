import {
  IsArray,
  ValidateNested,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FilterType } from '../schemas/category.schema.js';

export class CategoryFilterDto {
  @IsString()
  name!: string;

  @IsString()
  key!: string;

  @IsEnum(FilterType)
  type!: FilterType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsNumber()
  rangeMin?: number;

  @IsOptional()
  @IsNumber()
  rangeMax?: number;
}

export class UpdateFiltersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryFilterDto)
  filters!: CategoryFilterDto[];
}
