import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationListComponent } from './conversation-list.component';
import { MessagingService, ConversationsResponse } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Conversation } from '../../../core/models';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    _id: overrides._id ?? 'conv1',
    productListingId: overrides.productListingId ?? 'listing1',
    buyerId: overrides.buyerId ?? 'buyer1',
    sellerId: overrides.sellerId ?? 'seller1',
    lastMessageAt: overrides.lastMessageAt ?? new Date(),
    lastMessagePreview: overrides.lastMessagePreview ?? 'Hello!',
    createdAt: overrides.createdAt ?? new Date(),
  };
}

describe('ConversationListComponent', () => {
  let component: ConversationListComponent;
  let messagingServiceMock: { getConversations: ReturnType<typeof vi.fn> };
  let wsServiceMock: { connect: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
  let authServiceMock: { user: ReturnType<typeof vi.fn> };
  let wsSubject: Subject<unknown>;

  const mockConversations: Conversation[] = [
    makeConversation({ _id: 'c1', lastMessagePreview: 'Is this available?', lastMessageAt: new Date('2024-01-15T10:00:00Z') }),
    makeConversation({ _id: 'c2', lastMessagePreview: 'What price?', lastMessageAt: new Date('2024-01-15T12:00:00Z') }),
  ];

  beforeEach(() => {
    wsSubject = new Subject();

    messagingServiceMock = {
      getConversations: vi.fn().mockReturnValue(of({ data: mockConversations, total: 2 } as ConversationsResponse)),
    };

    wsServiceMock = {
      connect: vi.fn(),
      on: vi.fn().mockReturnValue(wsSubject.asObservable()),
    };

    authServiceMock = {
      user: vi.fn().mockReturnValue({ _id: 'user1' }),
    };

    component = new ConversationListComponent(
      messagingServiceMock as unknown as MessagingService,
      wsServiceMock as unknown as WebSocketService,
      authServiceMock as unknown as AuthService,
    );
  });

  afterEach(() => {
    wsSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading true initially', () => {
    expect(component.loading()).toBe(true);
  });

  it('should load conversations on init', () => {
    component.ngOnInit();
    expect(messagingServiceMock.getConversations).toHaveBeenCalled();
    expect(component.conversations().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should connect to WebSocket on init', () => {
    component.ngOnInit();
    expect(wsServiceMock.connect).toHaveBeenCalled();
  });

  it('should listen for new_message events', () => {
    component.ngOnInit();
    expect(wsServiceMock.on).toHaveBeenCalledWith('new_message');
  });

  it('should set error on load failure', () => {
    messagingServiceMock.getConversations = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
    component = new ConversationListComponent(
      messagingServiceMock as unknown as MessagingService,
      wsServiceMock as unknown as WebSocketService,
      authServiceMock as unknown as AuthService,
    );
    component.ngOnInit();
    expect(component.error()).toBe('Failed to load conversations');
    expect(component.loading()).toBe(false);
  });

  it('should update conversation on new_message event', () => {
    component.ngOnInit();
    wsSubject.next({ conversationId: 'c1', content: 'New message!', createdAt: new Date().toISOString() });
    const updated = component.conversations().find((c) => c._id === 'c1');
    expect(updated?.lastMessagePreview).toBe('New message!');
  });

  it('should sort conversations by lastMessageAt after new message', () => {
    component.ngOnInit();
    // c1 was older, send new message to c1 to make it most recent
    wsSubject.next({ conversationId: 'c1', content: 'Latest!', createdAt: new Date().toISOString() });
    expect(component.conversations()[0]._id).toBe('c1');
  });

  it('should format time as "Just now" for recent messages', () => {
    const result = component.getTimeAgo(new Date());
    expect(result).toBe('Just now');
  });

  it('should format time as minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = component.getTimeAgo(fiveMinAgo);
    expect(result).toBe('5m ago');
  });

  it('should format time as hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = component.getTimeAgo(twoHoursAgo);
    expect(result).toBe('2h ago');
  });

  it('should format time as days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = component.getTimeAgo(threeDaysAgo);
    expect(result).toBe('3d ago');
  });

  it('should show date string for messages older than a week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = component.getTimeAgo(twoWeeksAgo);
    expect(result).toBe(twoWeeksAgo.toLocaleDateString());
  });

  it('should unsubscribe on destroy', () => {
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
