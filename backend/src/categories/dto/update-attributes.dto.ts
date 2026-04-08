import {
  IsArray,
  ValidateNested,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttributeType } from '../schemas/category.schema.js';

export class CategoryAttributeDto {
  @IsString()
  name!: string;

  @IsString()
  key!: string;

  @IsEnum(AttributeType)
  type!: AttributeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  rangeMin?: number;

  @IsOptional()
  @IsNumber()
  rangeMax?: number;
}

export class UpdateAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryAttributeDto)
  attributes!: CategoryAttributeDto[];
}
