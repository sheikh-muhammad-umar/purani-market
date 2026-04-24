import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { AttributeType } from '../schemas/category.schema.js';

export class UpdateAttributeDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  rangeMin?: number;

  @IsOptional()
  @IsNumber()
  rangeMax?: number;

  @IsOptional()
  @IsBoolean()
  allowOther?: boolean;
}
