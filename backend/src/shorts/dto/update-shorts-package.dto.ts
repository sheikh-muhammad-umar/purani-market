import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Validate,
} from 'class-validator';
import { IsAllowedShortsDurationConstraint } from './create-shorts-package.dto.js';

export class UpdateShortsPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Validate(IsAllowedShortsDurationConstraint)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
