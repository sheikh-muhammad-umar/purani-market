import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { OtpChannel } from '../../common/enums/otp-channel.enum.js';

export { OtpChannel } from '../../common/enums/otp-channel.enum.js';

const WHATSAPP_PREFIX = 'whatsapp:';
const OTP_MESSAGE_TEMPLATE = (otp: string) =>
  `Your Marketplace verification code is: ${otp}. It expires in 10 minutes.`;
const REMINDER_MESSAGE =
  'Reminder: Please verify your phone number on Marketplace.';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: Twilio | null;
  private readonly smsFrom: string;
  private readonly whatsappFrom: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.smsFrom = this.configService.get<string>('twilio.phoneNumber') || '';
    this.whatsappFrom =
      this.configService.get<string>('twilio.whatsappNumber') || '';

    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
      this.logger.log('Twilio configured for SMS/WhatsApp');
    } else {
      this.client = null;
      this.logger.warn(
        'Twilio not configured — SMS/WhatsApp will be logged to console only',
      );
    }
  }

  async sendOtp(
    phone: string,
    otp: string,
    channel: OtpChannel = OtpChannel.SMS,
  ): Promise<void> {
    const body = OTP_MESSAGE_TEMPLATE(otp);

    if (channel === OtpChannel.WHATSAPP) {
      await this.sendWhatsApp(phone, body);
    } else {
      await this.sendSms(phone, body);
    }
  }

  async sendReminderSms(phone: string): Promise<void> {
    await this.sendSms(phone, REMINDER_MESSAGE);
  }

  private async sendSms(to: string, body: string): Promise<void> {
    if (!this.client || !this.smsFrom) {
      this.logger.log(`[STUB SMS] To: ${to} | ${body}`);
      return;
    }

    try {
      await this.client.messages.create({ to, from: this.smsFrom, body });
      this.logger.log(`SMS sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${to}: ${(error as Error).message}`,
      );
    }
  }

  private async sendWhatsApp(to: string, body: string): Promise<void> {
    if (!this.client || !this.whatsappFrom) {
      this.logger.log(`[STUB WhatsApp] To: ${to} | ${body}`);
      return;
    }

    try {
      await this.client.messages.create({
        to: `${WHATSAPP_PREFIX}${to}`,
        from: `${WHATSAPP_PREFIX}${this.whatsappFrom}`,
        body,
      });
      this.logger.log(`WhatsApp message sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp to ${to}: ${(error as Error).message}`,
      );
    }
  }
}
