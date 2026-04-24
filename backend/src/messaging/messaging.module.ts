import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
import { ListingsModule } from '../listings/listings.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ListingsModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway, ChatMediaService],
  exports: [MessagingService, MessagingGateway, MongooseModule],
})
export class MessagingModule {}
