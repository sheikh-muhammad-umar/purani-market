import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProvinceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
