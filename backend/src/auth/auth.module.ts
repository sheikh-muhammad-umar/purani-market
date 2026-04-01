import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import {
  VerificationToken,
  VerificationTokenSchema,
} from './schemas/verification-token.schema.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { EmailService } from './services/email.service.js';
import { SmsService } from './services/sms.service.js';
import { VerifiedUserGuard } from './guards/verified-user.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.accessExpiration') ?? '15m') as any,
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: VerificationToken.name, schema: VerificationTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, SmsService, VerifiedUserGuard, JwtStrategy],
  exports: [AuthService, EmailService, SmsService, VerifiedUserGuard, JwtModule],
})
export class AuthModule {}
