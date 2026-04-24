import {
  IsArray,
  ValidateNested,
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignAttributeDto {
  @IsString()
  definitionId!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Per-category option overrides (e.g. different brand lists per category) */
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

export class AssignAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignAttributeDto)
  attributes!: AssignAttributeDto[];
}
