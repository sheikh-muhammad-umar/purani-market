export declare class SmsService {
    private readonly logger;
    sendOtp(phone: string, otp: string): Promise<void>;
    sendReminderSms(phone: string): Promise<void>;
}
