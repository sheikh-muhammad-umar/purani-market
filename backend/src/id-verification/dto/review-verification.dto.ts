import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IdVerificationStatus } from '../schemas/id-verification.schema.js';

export class ReviewVerificationDto {
  @IsEnum(IdVerificationStatus)
  status!: IdVerificationStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
