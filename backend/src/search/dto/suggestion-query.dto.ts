import { IsOptional, IsString, MinLength } from 'class-validator';

export class SuggestionQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;
}
