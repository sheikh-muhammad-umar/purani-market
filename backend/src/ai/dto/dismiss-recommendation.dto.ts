import { IsString, IsMongoId } from 'class-validator';

export class DismissRecommendationDto {
  @IsString()
  @IsMongoId()
  productListingId!: string;
}
