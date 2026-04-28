import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Conversation, Message, MessageType } from '../models';
import { API } from '../constants/api-endpoints';
import { PAGE_SIZE_DEFAULT } from '../constants/app';

export interface ConversationsResponse {
  data: Conversation[];
  total: number;
}

export interface MessagesResponse {
  data: Message[];
  total: number;
  page: number;
  limit: number;
}

export interface StartConversationPayload {
  productListingId: string;
  message: string;
}

export interface SendMessagePayload {
  content?: string;
  type?: MessageType;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLive?: boolean;
    liveDurationMinutes?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  constructor(private readonly api: ApiService) {}

  getConversations(): Observable<ConversationsResponse> {
    return this.api.get<ConversationsResponse>(API.CONVERSATIONS);
  }

  getMessages(conversationId: string, page: number = 1): Observable<MessagesResponse> {
    return this.api.get<MessagesResponse>(API.CONVERSATION_MESSAGES(conversationId), {
      page,
      limit: PAGE_SIZE_DEFAULT,
    });
  }

  startConversation(payload: StartConversationPayload): Observable<Conversation> {
    return this.api.post<Conversation>(API.CONVERSATIONS, payload);
  }

  sendMessage(conversationId: string, content: string): Observable<Message> {
    return this.api.post<Message>(API.CONVERSATION_MESSAGES(conversationId), { content });
  }

  sendRichMessage(conversationId: string, payload: SendMessagePayload): Observable<Message> {
    return this.api.post<Message>(API.CONVERSATION_MESSAGES(conversationId), payload);
  }

  sendImageMessage(conversationId: string, file: File): Observable<Message> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<Message>(API.CONVERSATION_MESSAGES_IMAGE(conversationId), formData);
  }

  sendVoiceMessage(conversationId: string, blob: Blob, duration: number): Observable<Message> {
    const formData = new FormData();
    formData.append('file', blob, `voice-${Date.now()}.webm`);
    formData.append('duration', duration.toString());
    return this.api.post<Message>(API.CONVERSATION_MESSAGES_VOICE(conversationId), formData);
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>(API.CONVERSATIONS_UNREAD_COUNT);
  }

  getUnreadPerConversation(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>(API.CONVERSATIONS_UNREAD_PER);
  }

  markAsRead(conversationId: string): Observable<{ marked: number }> {
    return this.api.post<{ marked: number }>(API.CONVERSATION_READ(conversationId), {});
  }
}
