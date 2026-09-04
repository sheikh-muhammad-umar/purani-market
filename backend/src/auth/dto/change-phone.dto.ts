import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangePhoneDto {
  @IsString()
  @IsNotEmpty()
  newPhone!: string;

  /**
   * The account password, required only when the number actually moves.
   *
   * Optional here because this endpoint serves two jobs: re-sending a code to the
   * number already on the account (which listing creation relies on, and which
   * changes nothing), and moving the recovery number to a new one (which is an
   * account handover). Only the service can tell those apart, so it enforces the
   * requirement in the branch where it applies rather than the shape doing it
   * blindly for both.
   */
  @IsString()
  @IsOptional()
  password?: string;
}
