export declare class EmailService {
    private readonly logger;
    sendVerificationEmail(email: string, token: string): Promise<void>;
    sendReminderEmail(email: string): Promise<void>;
    sendPasswordResetEmail(email: string, token: string): Promise<void>;
    sendEmailChangeVerification(newEmail: string, token: string): Promise<void>;
    sendEmailChangeNotification(oldEmail: string): Promise<void>;
}
