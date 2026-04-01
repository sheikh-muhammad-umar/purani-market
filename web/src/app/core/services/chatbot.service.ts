import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotRequest {
  message: string;
  sessionId: string;
  history: ChatMessage[];
}

export interface ChatbotResponse {
  reply: string;
  escalate?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  constructor(private readonly api: ApiService) {}

  sendMessage(request: ChatbotRequest): Observable<ChatbotResponse> {
    return this.api.post<ChatbotResponse>('/chatbot/message', request);
  }
}
