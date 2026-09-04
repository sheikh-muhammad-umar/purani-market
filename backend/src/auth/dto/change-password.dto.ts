import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

/**
 * Changing a password you already know.
 *
 * There was no way to do this while signed in: the only path to a new password
 * was the emailed reset link, so anyone who merely suspected their password was
 * compromised had to send themselves a recovery email. That also meant the app
 * had no operation that rotated a password *and* proved knowledge of the old one.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
