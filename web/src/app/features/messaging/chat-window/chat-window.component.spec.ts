import { of, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatWindowComponent } from './chat-window.component';
import { MessagingService, MessagesResponse } from '../../../core/services/messaging.service';
import { ListingsService } from '../../../core/services/listings.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { ActivatedRoute } from '@angular/router';
import { Message, Listing, Conversation } from '../../../core/models';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    _id: overrides._id ?? 'msg1',
    conversationId: overrides.conversationId ?? 'conv1',
    senderId: overrides.senderId ?? 'user1',
    content: overrides.content ?? 'Hello!',
    isRead: overrides.isRead ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    _id: overrides._id ?? 'listing1',
    sellerId: 'seller1',
    title: overrides.title ?? 'Test Product',
    description: 'A test product',
    price: overrides.price ?? { amount: 5000, currency: 'PKR' },
    categoryId: 'cat1',
    categoryPath: ['cat1'],
    condition: 'used',
    categoryAttributes: {},
    images: overrides.images ?? [
      { url: 'https://img.test/1.jpg', thumbnailUrl: 'https://img.test/1_thumb.jpg', sortOrder: 0 },
    ],
    location: { type: 'Point', coordinates: [74.3, 31.5], city: 'Lahore', area: 'Gulberg' },
    contactInfo: { phone: '03001234567', email: 'test@test.com' },
    status: 'active',
    isFeatured: false,
    viewCount: 0,
    favoriteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let messagingServiceMock: {
    getMessages: ReturnType<typeof vi.fn>;
    getConversations: ReturnType<typeof vi.fn>;
  };
  let listingsServiceMock: { getById: ReturnType<typeof vi.fn> };
  let wsServiceMock: {
    connect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
  let authServiceMock: { user: ReturnType<typeof vi.fn> };
  let routeMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };

  let newMessageSubject: Subject<unknown>;
  let typingSubject: Subject<unknown>;
  let readSubject: Subject<unknown>;

  const mockMessages: Message[] = [
    makeMessage({
      _id: 'm1',
      senderId: 'user1',
      content: 'Hi there',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    }),
    makeMessage({
      _id: 'm2',
      senderId: 'seller1',
      content: 'Hello!',
      createdAt: new Date('2024-01-15T10:01:00Z'),
    }),
  ];

  const mockListing = makeListing({ _id: 'listing1', title: 'iPhone 15' });

  const mockConversation: Conversation = {
    _id: 'conv1',
    productListingId: 'listing1',
    buyerId: 'user1',
    sellerId: 'seller1',
    lastMessageAt: new Date(),
    lastMessagePreview: 'Hello!',
    createdAt: new Date(),
  };

  beforeEach(() => {
    newMessageSubject = new Subject();
    typingSubject = new Subject();
    readSubject = new Subject();

    messagingServiceMock = {
      getMessages: vi
        .fn()
        .mockReturnValue(
          of({ data: [...mockMessages], total: 2, page: 1, limit: 20 } as MessagesResponse),
        ),
      getConversations: vi.fn().mockReturnValue(of({ data: [mockConversation], total: 1 })),
    };

    listingsServiceMock = {
      getById: vi.fn().mockReturnValue(of(mockListing)),
    };

    wsServiceMock = {
      connect: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockImplementation((event: string) => {
        if (event === 'new_message') return newMessageSubject.asObservable();
        if (event === 'typing') return typingSubject.asObservable();
        if (event === 'messages_read') return readSubject.asObservable();
        return new Subject().asObservable();
      }),
    };

    authServiceMock = {
      user: vi.fn().mockReturnValue({ _id: 'user1' }),
    };

    routeMock = {
      snapshot: { paramMap: { get: vi.fn().mockReturnValue('conv1') } },
    };

    component = new ChatWindowComponent(
      routeMock as unknown as ActivatedRoute,
      messagingServiceMock as unknown as MessagingService,
      listingsServiceMock as unknown as ListingsService,
      wsServiceMock as unknown as WebSocketService,
      authServiceMock as unknown as AuthService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
  });

  afterEach(() => {
    newMessageSubject.complete();
    typingSubject.complete();
    readSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set conversationId from route params', () => {
    component.ngOnInit();
    expect(component.conversationId).toBe('conv1');
  });

  it('should connect to WebSocket on init', () => {
    component.ngOnInit();
    expect(wsServiceMock.connect).toHaveBeenCalled();
  });

  it('should load messages on init', () => {
    component.ngOnInit();
    expect(messagingServiceMock.getMessages).toHaveBeenCalledWith('conv1', 1);
    expect(component.messages().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should load listing info after messages load', () => {
    component.ngOnInit();
    expect(messagingServiceMock.getConversations).toHaveBeenCalled();
    expect(listingsServiceMock.getById).toHaveBeenCalledWith('listing1');
    expect(component.listing()?.title).toBe('iPhone 15');
  });

  it('should identify sent messages correctly', () => {
    component.ngOnInit();
    const sentMsg = makeMessage({ senderId: 'user1' });
    const receivedMsg = makeMessage({ senderId: 'seller1' });
    expect(component.isSentByMe(sentMsg)).toBe(true);
    expect(component.isSentByMe(receivedMsg)).toBe(false);
  });

  it('should send message via WebSocket', () => {
    component.ngOnInit();
    component.messageText = 'Test message';
    component.sendMessage();
    expect(wsServiceMock.send).toHaveBeenCalledWith('send_message', {
      conversationId: 'conv1',
      content: 'Test message',
    });
  });

  it('should add optimistic message on send', () => {
    component.ngOnInit();
    const initialCount = component.messages().length;
    component.messageText = 'New message';
    component.sendMessage();
    expect(component.messages().length).toBe(initialCount + 1);
    expect(component.messages()[component.messages().length - 1].content).toBe('New message');
  });

  it('should clear input after sending', () => {
    component.ngOnInit();
    component.messageText = 'Test';
    component.sendMessage();
    expect(component.messageText).toBe('');
  });

  it('should not send empty messages', () => {
    component.ngOnInit();
    component.messageText = '   ';
    component.sendMessage();
    expect(wsServiceMock.send).not.toHaveBeenCalledWith('send_message', expect.anything());
  });

  it('should send quick reply', () => {
    component.ngOnInit();
    component.sendQuickReply('Is this still available?');
    expect(wsServiceMock.send).toHaveBeenCalledWith('send_message', {
      conversationId: 'conv1',
      content: 'Is this still available?',
    });
  });

  it('should have correct quick reply options', () => {
    expect(component.quickReplies).toContain('Is this still available?');
    expect(component.quickReplies).toContain("What's your best price?");
    expect(component.quickReplies).toContain('Can I see it today?');
    expect(component.quickReplies).toContain('Is the price negotiable?');
  });

  it('should emit typing event on input', () => {
    component.ngOnInit();
    component.onTyping();
    expect(wsServiceMock.send).toHaveBeenCalledWith('typing', { conversationId: 'conv1' });
  });

  it('should show typing indicator on typing event from other user', () => {
    component.ngOnInit();
    typingSubject.next({ conversationId: 'conv1', userId: 'seller1' });
    expect(component.typingIndicator()).toBe(true);
  });

  it('should not show typing indicator for own typing', () => {
    component.ngOnInit();
    typingSubject.next({ conversationId: 'conv1', userId: 'user1' });
    expect(component.typingIndicator()).toBe(false);
  });

  it('should mark messages as read on messages_read event', () => {
    component.ngOnInit();
    readSubject.next({ conversationId: 'conv1' });
    const allRead = component.messages().every((m) => m.isRead);
    expect(allRead).toBe(true);
  });

  it('should add incoming message from WebSocket', () => {
    component.ngOnInit();
    const initialCount = component.messages().length;
    newMessageSubject.next({
      _id: 'new1',
      conversationId: 'conv1',
      senderId: 'seller1',
      content: 'New incoming!',
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    expect(component.messages().length).toBe(initialCount + 1);
  });

  it('should not duplicate messages from WebSocket', () => {
    component.ngOnInit();
    const existingMsg = component.messages()[0];
    newMessageSubject.next(existingMsg);
    // Count should remain the same
    const count = component.messages().filter((m) => m._id === existingMsg._id).length;
    expect(count).toBe(1);
  });

  it('should set hasMore to false when fewer than 20 messages returned', () => {
    component.ngOnInit();
    expect(component.hasMore()).toBe(false); // only 2 messages returned
  });

  it('should load older messages on loadOlderMessages', () => {
    // Set hasMore to true by returning exactly 20 messages
    const twentyMessages = Array.from({ length: 20 }, (_, i) =>
      makeMessage({ _id: `m${i}`, content: `Message ${i}` }),
    );
    messagingServiceMock.getMessages = vi
      .fn()
      .mockReturnValue(
        of({ data: twentyMessages, total: 40, page: 1, limit: 20 } as MessagesResponse),
      );
    component = new ChatWindowComponent(
      routeMock as unknown as ActivatedRoute,
      messagingServiceMock as unknown as MessagingService,
      listingsServiceMock as unknown as ListingsService,
      wsServiceMock as unknown as WebSocketService,
      authServiceMock as unknown as AuthService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
    component.ngOnInit();
    expect(component.hasMore()).toBe(true);

    // Now load older
    const olderMessages = [makeMessage({ _id: 'old1', content: 'Old message' })];
    messagingServiceMock.getMessages = vi
      .fn()
      .mockReturnValue(
        of({ data: olderMessages, total: 21, page: 2, limit: 20 } as MessagesResponse),
      );
    component.loadOlderMessages();
    expect(component.currentPage()).toBe(2);
  });

  it('should format time correctly', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    const result = component.formatTime(date);
    // Should contain time in HH:MM format
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should return listing thumbnail image', () => {
    component.ngOnInit();
    const img = component.getListingImage();
    expect(img).toBe('https://img.test/1_thumb.jpg');
  });

  it('should return placeholder when no listing', () => {
    const img = component.getListingImage();
    expect(img).toBe('assets/placeholder.png');
  });

  it('should clean up subscriptions on destroy', () => {
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('should not load messages if no conversationId', () => {
    routeMock.snapshot.paramMap.get = vi.fn().mockReturnValue(null);
    component = new ChatWindowComponent(
      routeMock as unknown as ActivatedRoute,
      messagingServiceMock as unknown as MessagingService,
      listingsServiceMock as unknown as ListingsService,
      wsServiceMock as unknown as WebSocketService,
      authServiceMock as unknown as AuthService,
      { track: vi.fn() } as unknown as ActivityTrackerService,
    );
    messagingServiceMock.getMessages.mockClear();
    component.ngOnInit();
    expect(messagingServiceMock.getMessages).not.toHaveBeenCalled();
  });
});
