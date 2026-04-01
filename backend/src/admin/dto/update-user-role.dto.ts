import { IsEnum } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema.js';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
