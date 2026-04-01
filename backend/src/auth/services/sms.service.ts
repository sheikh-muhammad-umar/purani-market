import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    this.logger.log(
      `[STUB] Sending OTP ${otp} to phone ${phone}`,
    );
  }

  async sendReminderSms(phone: string): Promise<void> {
    this.logger.log(
      `[STUB] Sending verification reminder SMS to ${phone}`,
    );
  }
}
