import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagingService, ConversationsResponse, MessagesResponse } from './messaging.service';
import { ApiService } from './api.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let apiMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiMock = {
      get: vi.fn(),
      post: vi.fn(),
    };
    service = new MessagingService(apiMock as unknown as ApiService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should call GET /conversations for getConversations', () => {
    const mockResponse: ConversationsResponse = { data: [], total: 0 };
    apiMock.get.mockReturnValue(of(mockResponse));

    service.getConversations().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    expect(apiMock.get).toHaveBeenCalledWith('/conversations');
  });

  it('should call GET /conversations/:id/messages with pagination', () => {
    const mockResponse: MessagesResponse = { data: [], total: 0, page: 1, limit: 20 };
    apiMock.get.mockReturnValue(of(mockResponse));

    service.getMessages('conv1', 2).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    expect(apiMock.get).toHaveBeenCalledWith('/conversations/conv1/messages', {
      page: 2,
      limit: 20,
    });
  });

  it('should default to page 1 for getMessages', () => {
    apiMock.get.mockReturnValue(of({ data: [], total: 0, page: 1, limit: 20 }));

    service.getMessages('conv1').subscribe();

    expect(apiMock.get).toHaveBeenCalledWith('/conversations/conv1/messages', {
      page: 1,
      limit: 20,
    });
  });

  it('should call POST /conversations for startConversation', () => {
    const payload = { productListingId: 'listing1', sellerId: 'seller1', message: 'Hi!' };
    apiMock.post.mockReturnValue(of({ _id: 'newConv' }));

    service.startConversation(payload).subscribe((res) => {
      expect(res._id).toBe('newConv');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/conversations', payload);
  });
});
