import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportStatus } from '../schemas/report.schema.js';

export class ReviewReportDto {
  /** Only terminal decisions are valid here — a review cannot set PENDING. */
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  /** Optional admin note; recommended (but not required) when rejecting. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Note must be at least 3 characters.' })
  @MaxLength(500, { message: 'Note must not exceed 500 characters.' })
  reviewNote?: string;
}
