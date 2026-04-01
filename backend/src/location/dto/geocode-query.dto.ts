import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  query!: string; // city name or postal code
}
