import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  productListingId?: string;

  @IsOptional()
  @IsString()
  shortVideoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}
