import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportReason, ReportTargetType } from '../schemas/report.schema.js';

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  /**
   * The reported entity's id: a User id when `targetType=user`, a
   * ProductListing id when `targetType=listing`. Validated as a Mongo id so a
   * malformed value is rejected before any DB/ObjectId work.
   */
  @IsMongoId()
  targetId!: string;

  @IsOptional()
  @IsEnum(ReportReason)
  reason?: ReportReason;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, {
    message: 'Please describe the problem (at least 10 characters).',
  })
  @MaxLength(2000, { message: 'Message must not exceed 2000 characters.' })
  message!: string;
}
