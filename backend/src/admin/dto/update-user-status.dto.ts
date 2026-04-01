import { IsEnum } from 'class-validator';
import { UserStatus } from '../../users/schemas/user.schema.js';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
