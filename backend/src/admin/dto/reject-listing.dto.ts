import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason!: string;
}
