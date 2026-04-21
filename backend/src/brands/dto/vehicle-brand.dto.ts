import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { VehicleType } from '../enums/vehicle-type.enum.js';

export class CreateVehicleBrandDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsMongoId()
  categoryId!: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVehicleBrandDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
