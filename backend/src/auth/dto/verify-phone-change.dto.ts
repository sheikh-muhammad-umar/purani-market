import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPhoneChangeDto {
  @IsString()
  @IsNotEmpty()
  otp!: string;
}
