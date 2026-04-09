import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class CreateCityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsMongoId()
  provinceId!: string;
}
