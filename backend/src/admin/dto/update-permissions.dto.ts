import { IsArray, IsString, IsEnum } from 'class-validator';
import { Permission } from '../../users/schemas/user.schema.js';

export class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  @IsEnum(Permission, { each: true })
  permissions!: string[];
}
