import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EMAIL_ROUTES,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FRONTEND_URL,
  BRAND_COLOR,
} from '../constants/email.constants.js';

const btnStyle = `padding:12px 24px;background:${BRAND_COLOR};color:#fff;border-radius:6px;text-decoration:none;display:inline-block;`;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');
    this.fromAddress =
      this.configService.get<string>('smtp.from') || DEFAULT_FROM_ADDRESS;

    const corsOrigins =
      this.configService.get<string>('cors.allowedOrigins') || '';
    this.frontendUrl =
      corsOrigins.split(',')[0]?.trim() || DEFAULT_FRONTEND_URL;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP configured: ${host}:${port}`);
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP not configured — emails will be logged to console only',
      );
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}${EMAIL_ROUTES.VERIFY_EMAIL}?token=${token}&email=${encodeURIComponent(email)}`;
    await this.send(
      email,
      'Verify your email — Marketplace',
      `<h2>Welcome to Marketplace!</h2>
       <p>Click the link below to verify your email address:</p>
       <p><a href="${link}" style="${btnStyle}">Verify Email</a></p>
       <p>Or copy this link: ${link}</p>
       <p>This link expires in 24 hours.</p>`,
    );
  }

  async sendReminderEmail(email: string): Promise<void> {
    await this.send(
      email,
      'Reminder: Verify your email — Marketplace',
      `<p>You haven't verified your email yet. Please check your inbox for the verification link, or request a new one from the app.</p>`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}${EMAIL_ROUTES.RESET_PASSWORD}?token=${token}`;
    await this.send(
      email,
      'Reset your password — Marketplace',
      `<h2>Password Reset</h2>
       <p>Click the link below to reset your password:</p>
       <p><a href="${link}" style="${btnStyle}">Reset Password</a></p>
       <p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
    );
  }

  async sendPasswordChangedEmail(email: string): Promise<void> {
    await this.send(
      email,
      'Your password was changed — Marketplace',
      `<h2>Password Changed</h2>
       <p>Your Marketplace password was just changed and all active sessions were signed out.</p>
       <p>If you made this change, no action is needed. If you didn't, reset your password immediately and contact support.</p>`,
    );
  }

  async sendPhoneChangeNotification(email: string): Promise<void> {
    await this.send(
      email,
      'Your phone number was changed — Marketplace',
      `<p>The phone number on your Marketplace account was just changed. If you didn't make this change, please contact support immediately.</p>`,
    );
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    await this.send(
      email,
      'Welcome to Marketplace!',
      `<h2>You're all set!</h2>
       <p>Your email has been verified and your Marketplace account is ready to go.</p>
       <p><a href="${this.frontendUrl}" style="${btnStyle}">Start exploring</a></p>`,
    );
  }

  async sendMfaEnabledEmail(email: string): Promise<void> {
    await this.send(
      email,
      'Two-factor authentication enabled — Marketplace',
      `<p>Two-factor authentication (2FA) was just enabled on your Marketplace account. If you didn't do this, contact support immediately.</p>`,
    );
  }

  async sendMfaDisabledEmail(email: string): Promise<void> {
    await this.send(
      email,
      'Two-factor authentication disabled — Marketplace',
      `<p>Two-factor authentication (2FA) was just disabled on your Marketplace account. If you didn't do this, secure your account and contact support immediately.</p>`,
    );
  }

  async sendAccountLockedEmail(
    email: string,
    lockoutMinutes: number,
  ): Promise<void> {
    await this.send(
      email,
      'Your account was temporarily locked — Marketplace',
      `<p>Your Marketplace account was temporarily locked after too many failed two-factor authentication attempts.</p>
       <p>Access will be restored automatically in about ${lockoutMinutes} minutes. If this wasn't you, reset your password once the lock lifts.</p>`,
    );
  }

  async sendNewDeviceLoginEmail(
    email: string,
    device: string,
    when: Date,
  ): Promise<void> {
    await this.send(
      email,
      'New sign-in to your account — Marketplace',
      `<h2>New sign-in detected</h2>
       <p>Your Marketplace account was just accessed from a new device:</p>
       <p><strong>Device:</strong> ${device}<br/>
          <strong>When:</strong> ${when.toUTCString()}</p>
       <p>If this was you, you can ignore this email. If not, reset your password immediately.</p>`,
    );
  }

  async sendEmailChangeVerification(
    newEmail: string,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}${EMAIL_ROUTES.VERIFY_EMAIL_CHANGE}?token=${token}`;
    await this.send(
      newEmail,
      'Confirm your new email — Marketplace',
      `<p>Click the link below to confirm your new email address:</p>
       <p><a href="${link}" style="${btnStyle}">Confirm Email</a></p>
       <p>This link expires in 24 hours.</p>`,
    );
  }

  async sendEmailChangeNotification(oldEmail: string): Promise<void> {
    await this.send(
      oldEmail,
      'Your email was changed — Marketplace',
      `<p>Your Marketplace account email has been changed. If you didn't make this change, please contact support immediately.</p>`,
    );
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    await this.send(
      email,
      'Your verification code — Marketplace',
      `<h2>Your Verification Code</h2>
       <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;">${otp}</p>
       <p>Enter this code in the app to verify your identity. It expires in 10 minutes.</p>
       <p>If you didn't request this, ignore this email.</p>`,
    );
  }

  async sendReportApprovedEmail(email: string, reason?: string): Promise<void> {
    await this.send(
      email,
      'A report against your account was upheld — Marketplace',
      `<h2>Report reviewed</h2>
       <p>Our moderation team reviewed a report about your account or one of your listings and found it valid.</p>
       ${reason ? `<p><strong>Note from the team:</strong> ${reason}</p>` : ''}
       <p>Repeated valid reports can lead to your account being suspended. Please review our community guidelines to make sure your listings and conduct comply.</p>`,
    );
  }

  async sendAccountSuspendedEmail(
    email: string,
    until: Date,
    reason?: string,
  ): Promise<void> {
    const untilStr = until.toUTCString();
    await this.send(
      email,
      'Your account has been suspended — Marketplace',
      `<h2>Account suspended</h2>
       <p>Your Marketplace account has been suspended following multiple upheld reports.</p>
       <p><strong>Suspended until:</strong> ${untilStr}</p>
       ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
       <p>During this period you cannot sign in and your active listings have been deactivated. Access is restored automatically once the suspension ends.</p>
       <p>If you believe this was a mistake, contact support.</p>`,
    );
  }

  async sendReviewApprovedEmail(
    email: string,
    sellerName: string,
  ): Promise<void> {
    await this.send(
      email,
      'Your review is live — Marketplace',
      `<h2>Review approved</h2>
       <p>Thanks for sharing your experience. Your review of <strong>${sellerName}</strong> has been approved and is now published on their profile.</p>`,
    );
  }

  async sendReviewRejectedEmail(
    email: string,
    sellerName: string,
    reason?: string,
  ): Promise<void> {
    await this.send(
      email,
      'Your review was not approved — Marketplace',
      `<h2>Review not approved</h2>
       <p>Your review of <strong>${sellerName}</strong> was reviewed by our moderation team and could not be approved, so it has been removed.</p>
       ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
       <p>You're welcome to submit a new review that follows our review guidelines.</p>`,
    );
  }

  async sendBroadcastEmail(
    email: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    await this.send(
      email,
      `${subject} — Marketplace`,
      `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
       ${htmlContent}
       <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb;">
       <p style="font-size:12px;color:#9ca3af;text-align:center;">
         You received this because you're a Marketplace user.
         <a href="${this.frontendUrl}/profile/notifications">Manage preferences</a>
       </p>
       </div>`,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[STUB] To: ${to} | Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${(error as Error).message}`,
      );
    }
  }
}
