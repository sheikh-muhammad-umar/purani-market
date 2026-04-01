import { IsNotEmpty, IsString } from 'class-validator';

export class AddFavoriteDto {
  @IsNotEmpty()
  @IsString()
  productListingId!: string;
}
