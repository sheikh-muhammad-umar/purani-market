import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Conversation, Message } from '../models';
import { API } from '../constants/api-endpoints';

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

@Injectable({ providedIn: 'root' })
export class MessagingService {
  constructor(private readonly api: ApiService) {}

  getConversations(): Observable<ConversationsResponse> {
    return this.api.get<ConversationsResponse>(API.CONVERSATIONS);
  }

  getMessages(conversationId: string, page: number = 1): Observable<MessagesResponse> {
    return this.api.get<MessagesResponse>(API.CONVERSATION_MESSAGES(conversationId), {
      page,
      limit: 20,
    });
  }

  startConversation(payload: StartConversationPayload): Observable<Conversation> {
    return this.api.post<Conversation>(API.CONVERSATIONS, payload);
  }

  sendMessage(conversationId: string, content: string): Observable<Message> {
    return this.api.post<Message>(API.CONVERSATION_MESSAGES(conversationId), { content });
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
