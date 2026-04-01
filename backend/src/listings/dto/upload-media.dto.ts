import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export class UploadMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
