import {
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  productListingId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}
