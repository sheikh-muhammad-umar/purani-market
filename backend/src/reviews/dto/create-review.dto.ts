import {
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReviewDto {
  /** The seller (user) being reviewed. A review is about the seller. */
  @IsMongoId()
  sellerId!: string;

  /** Optional context: the listing that prompted the review. */
  @IsOptional()
  @IsMongoId()
  productListingId?: string;

  // Sent as multipart form fields alongside images, so numbers arrive as
  // strings — coerce before validating.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  /** Required: a rating must be accompanied by a written comment. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'A comment is required.' })
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}
