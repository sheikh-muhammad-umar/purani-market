import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export class CreateVehicleVariantDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsMongoId()
  modelId!: string;

  @IsMongoId()
  brandId!: string;

  @IsMongoId()
  categoryId!: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVehicleVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
