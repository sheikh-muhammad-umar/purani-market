import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Conversation, Message } from '../models';

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
    return this.api.get<ConversationsResponse>('/conversations');
  }

  getMessages(conversationId: string, page: number = 1): Observable<MessagesResponse> {
    return this.api.get<MessagesResponse>(`/conversations/${conversationId}/messages`, {
      page,
      limit: 20,
    });
  }

  startConversation(payload: StartConversationPayload): Observable<Conversation> {
    return this.api.post<Conversation>('/conversations', payload);
  }

  sendMessage(conversationId: string, content: string): Observable<Message> {
    return this.api.post<Message>(`/conversations/${conversationId}/messages`, { content });
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('/conversations/unread-count');
  }

  getUnreadPerConversation(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>('/conversations/unread-per-conversation');
  }

  markAsRead(conversationId: string): Observable<{ marked: number }> {
    return this.api.post<{ marked: number }>(`/conversations/${conversationId}/read`, {});
  }
}
