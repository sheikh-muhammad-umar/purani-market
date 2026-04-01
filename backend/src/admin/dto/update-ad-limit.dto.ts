import { IsInt, Min } from 'class-validator';

export class UpdateAdLimitDto {
  @IsInt()
  @Min(0)
  adLimit!: number;
}
