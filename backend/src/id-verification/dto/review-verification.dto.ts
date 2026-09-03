import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IdVerificationStatus } from '../schemas/id-verification.schema.js';

export class ReviewVerificationDto {
  @IsEnum(IdVerificationStatus)
  status!: IdVerificationStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, {
    message: 'Rejection reason must be at least 10 characters.',
  })
  @MaxLength(500, {
    message: 'Rejection reason must not exceed 500 characters.',
  })
  rejectionReason?: string;
}
