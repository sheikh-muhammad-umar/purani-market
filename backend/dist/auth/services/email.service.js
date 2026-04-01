"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
let EmailService = EmailService_1 = class EmailService {
    logger = new common_1.Logger(EmailService_1.name);
    async sendVerificationEmail(email, token) {
        const verificationLink = `http://localhost:4200/verify-email?token=${token}`;
        this.logger.log(`[STUB] Sending verification email to ${email} with link: ${verificationLink}`);
    }
    async sendReminderEmail(email) {
        this.logger.log(`[STUB] Sending verification reminder email to ${email}`);
    }
    async sendPasswordResetEmail(email, token) {
        const resetLink = `http://localhost:4200/reset-password?token=${token}`;
        this.logger.log(`[STUB] Sending password reset email to ${email} with link: ${resetLink}`);
    }
    async sendEmailChangeVerification(newEmail, token) {
        const verificationLink = `http://localhost:4200/verify-email-change?token=${token}`;
        this.logger.log(`[STUB] Sending email change verification to ${newEmail} with link: ${verificationLink}`);
    }
    async sendEmailChangeNotification(oldEmail) {
        this.logger.log(`[STUB] Sending email change notification to old email ${oldEmail}`);
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)()
], EmailService);
//# sourceMappingURL=email.service.js.map