import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { ChatbotService, ChatbotResponse } from './chatbot.service';
import { ApiService } from './api.service';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let apiService: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiService = {
      post: vi.fn(),
    };
    service = new ChatbotService(apiService as unknown as ApiService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should call POST /chatbot/message with correct payload', () => {
    const mockResponse: ChatbotResponse = { reply: 'Hello!', escalate: false };
    apiService.post.mockReturnValue(of(mockResponse));

    const request = {
      message: 'Hi',
      sessionId: 'session-123',
      history: [{ role: 'user' as const, content: 'Hi' }],
    };

    service.sendMessage(request).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    expect(apiService.post).toHaveBeenCalledWith('/chatbot/message', request);
  });

  it('should pass escalate flag from response', () => {
    const mockResponse: ChatbotResponse = { reply: 'Escalating...', escalate: true };
    apiService.post.mockReturnValue(of(mockResponse));

    service
      .sendMessage({
        message: 'Complex issue',
        sessionId: 'session-456',
        history: [],
      })
      .subscribe((res) => {
        expect(res.escalate).toBe(true);
      });
  });
});
