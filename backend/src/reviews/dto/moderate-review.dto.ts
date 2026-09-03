import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReviewStatus } from '../schemas/review.schema.js';

export class ModerateReviewDto {
  /** Only terminal decisions are valid — moderation cannot set PENDING. */
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  status!: ReviewStatus.APPROVED | ReviewStatus.REJECTED;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Note must be at least 3 characters.' })
  @MaxLength(500, { message: 'Note must not exceed 500 characters.' })
  moderationNote?: string;
}
