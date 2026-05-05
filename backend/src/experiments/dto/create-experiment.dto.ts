import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class VariantDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsOptional()
  config?: Record<string, any> = {};
}

export class CreateExperimentDto {
  @IsString()
  @MaxLength(50)
  key!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants!: VariantDto[];
}
