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
      `Your verification code: ${otp} — Marketplace`,
      `<h2>Your Verification Code</h2>
       <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;">${otp}</p>
       <p>Enter this code in the app to verify your identity. It expires in 10 minutes.</p>
       <p>If you didn't request this, ignore this email.</p>`,
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
