import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateRejectionReasonDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
