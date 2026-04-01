import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const verificationLink = `http://localhost:4200/verify-email?token=${token}`;
    this.logger.log(
      `[STUB] Sending verification email to ${email} with link: ${verificationLink}`,
    );
  }

  async sendReminderEmail(email: string): Promise<void> {
    this.logger.log(
      `[STUB] Sending verification reminder email to ${email}`,
    );
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const resetLink = `http://localhost:4200/reset-password?token=${token}`;
    this.logger.log(
      `[STUB] Sending password reset email to ${email} with link: ${resetLink}`,
    );
  }

  async sendEmailChangeVerification(
    newEmail: string,
    token: string,
  ): Promise<void> {
    const verificationLink = `http://localhost:4200/verify-email-change?token=${token}`;
    this.logger.log(
      `[STUB] Sending email change verification to ${newEmail} with link: ${verificationLink}`,
    );
  }

  async sendEmailChangeNotification(oldEmail: string): Promise<void> {
    this.logger.log(
      `[STUB] Sending email change notification to old email ${oldEmail}`,
    );
  }
}
