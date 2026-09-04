import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @IsNotEmpty()
  newEmail!: string;

  /**
   * The account password, re-entered.
   *
   * Changing the address is the one operation that hands the account over: the
   * new address receives password resets, so an access token alone was enough to
   * take an account permanently. Re-asking for the password means a stolen token
   * is not sufficient.
   */
  @IsString()
  @IsNotEmpty()
  password!: string;
}
