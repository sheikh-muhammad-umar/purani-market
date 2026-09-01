import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundPurchaseDto {
  /**
   * Shown to the seller in the refund notification and kept on the purchase for
   * the audit trail, so "why was I refunded?" has an answer.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
