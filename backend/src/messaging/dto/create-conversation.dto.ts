import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  productListingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}
