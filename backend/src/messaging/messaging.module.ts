import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema.js';
import { Message, MessageSchema } from './schemas/message.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { MessagingService } from './messaging.service.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingGateway } from './messaging.gateway.js';
import { ChatMediaService } from './chat-media.service.js';
import { MessagingCleanupService } from './messaging-cleanup.service.js';
import { ListingsModule } from '../listings/listings.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.accessExpiration') ??
            '15m') as any,
        },
      }),
    }),
    ListingsModule,
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingGateway,
    ChatMediaService,
    MessagingCleanupService,
  ],
  exports: [MessagingService, MessagingGateway, MongooseModule],
})
export class MessagingModule {}
