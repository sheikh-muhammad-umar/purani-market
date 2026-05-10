import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { getShortsDurations } from '../../packages/constants/package-durations.js';

@ValidatorConstraint({ name: 'isAllowedShortsDuration', async: false })
export class IsAllowedShortsDurationConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return getShortsDurations().includes(value);
  }

  defaultMessage(): string {
    return `duration must be one of: ${getShortsDurations().join(', ')}`;
  }
}

export class CreateShortsPackageDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Validate(IsAllowedShortsDurationConstraint)
  duration!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
