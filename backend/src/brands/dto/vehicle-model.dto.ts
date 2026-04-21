import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export class CreateVehicleModelDto {
  @IsString()
  @MaxLength(100)
  name!: string;

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

export class UpdateVehicleModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
