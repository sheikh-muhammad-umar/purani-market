import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, signal, computed, input, output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService, MessagesResponse } from '../../../core/services/messaging.service';
import { ListingUrlPipe } from '../../../shared/pipes/listing-url.pipe';
import { ListingsService } from '../../../core/services/listings.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Message, Listing } from '../../../core/models';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ListingUrlPipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  // Input for split-pane mode
  conversationIdInput = input<string | null>(null);
  back = output<void>();

  readonly messages = signal<Message[]>([]);
  readonly listing = signal<Listing | null>(null);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly typingIndicator = signal(false);
  readonly currentPage = signal(1);
  readonly hasMore = signal(true);
  readonly loadingMore = signal(false);

  messageText = '';
  conversationId = '';

  readonly quickReplies: string[] = [
    'Is this still available?',
    "What's your best price?",
    'Can I see it today?',
    'Is the price negotiable?',
  ];

  readonly currentUserId = computed(() => this.authService.user()?._id ?? '');

  private subscriptions: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly messagingService: MessagingService,
    private readonly listingsService: ListingsService,
    private readonly wsService: WebSocketService,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Use input if provided (split-pane mode), otherwise use route param
    const inputId = this.conversationIdInput();
    this.conversationId = inputId || this.route.snapshot.paramMap.get('id') || '';
    if (!this.conversationId) return;

    this.initChat();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const newId = this.conversationIdInput();
    if (newId && newId !== this.conversationId) {
      this.conversationId = newId;
      this.messages.set([]);
      this.loading.set(true);
      this.initChat();
    }
  }

  private initChat(): void {

    // Ensure user is loaded, then connect socket with userId
    const user = this.authService.user();
    if (user?._id) {
      this.wsService.connect(user._id);
      this.loadMessages();
      this.listenForRealTimeEvents();
    } else {
      this.authService.fetchCurrentUser().subscribe({
        next: (u) => {
          this.wsService.connect(u._id);
          this.loadMessages();
          this.listenForRealTimeEvents();
        },
        error: () => {
          // Still load messages via HTTP even if socket fails
          this.loadMessages();
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text || this.sending()) return;

    this.sending.set(true);

    // Optimistic update
    const optimisticMsg: Message = {
      _id: `temp-${Date.now()}`,
      conversationId: this.conversationId,
      senderId: this.currentUserId(),
      content: text,
      isRead: false,
      createdAt: new Date(),
    };
    this.messages.update((msgs) => [...msgs, optimisticMsg]);
    this.messageText = '';
    this.scrollToBottom();

    this.messagingService.sendMessage(this.conversationId, text).subscribe({
      next: (saved) => {
        // Replace optimistic message with the real one
        this.messages.update((msgs) =>
          msgs.map((m) => m._id === optimisticMsg._id ? { ...saved } as any : m)
        );
        this.sending.set(false);
      },
      error: () => {
        // Remove optimistic message on failure
        this.messages.update((msgs) => msgs.filter((m) => m._id !== optimisticMsg._id));
        this.sending.set(false);
      },
    });
  }

  sendQuickReply(text: string): void {
    this.messageText = text;
    this.sendMessage();
  }

  onTyping(): void {
    this.wsService.send('typing', { conversationId: this.conversationId });
  }

  loadOlderMessages(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const nextPage = this.currentPage() + 1;

    this.messagingService.getMessages(this.conversationId, nextPage).subscribe({
      next: (res: any) => {
        const msgs = Array.isArray(res) ? res : res.messages ?? res.data ?? [];
        this.messages.update((existing) => [...[...msgs].reverse(), ...existing]);
        this.currentPage.set(nextPage);
        this.hasMore.set(msgs.length === 20);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  isSentByMe(message: Message): boolean {
    const senderId = typeof message.senderId === 'object'
      ? (message.senderId as any)?._id
      : message.senderId;
    return senderId === this.currentUserId();
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getListingImage(): string {
    const l = this.listing();
    return l?.images?.[0]?.thumbnailUrl || l?.images?.[0]?.url || 'assets/placeholder.png';
  }

  private loadMessages(): void {
    this.messagingService.getMessages(this.conversationId, 1).subscribe({
      next: (res: any) => {
        const msgs = Array.isArray(res) ? res : res.messages ?? res.data ?? [];
        this.messages.set([...msgs].reverse());
        this.hasMore.set(msgs.length === 20);
        this.loading.set(false);
        this.scrollToBottom();

        // Mark all messages in this conversation as read
        this.messagingService.markAsRead(this.conversationId).subscribe();

        this.loadConversationListing();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadConversationListing(): void {
    this.messagingService.getConversations().subscribe({
      next: (res: any) => {
        const conversations = Array.isArray(res) ? res : res.data ?? [];
        const conv = conversations.find((c: any) => c._id === this.conversationId);
        const listingId = conv?.productListingId?._id || conv?.productListingId;
        if (listingId) {
          this.listingsService.getById(listingId).subscribe({
            next: (listing) => this.listing.set(listing),
          });
        }
      },
    });
  }

  private listenForRealTimeEvents(): void {
    const msgSub = this.wsService.on('newMessage').subscribe((data) => {
      const msg = data as Message;
      if (msg.conversationId === this.conversationId) {
        // Avoid duplicating optimistic messages
        this.messages.update((msgs) => {
          const exists = msgs.some((m) => m._id === msg._id);
          if (exists) return msgs;
          // Remove temp message with same content if it exists
          const filtered = msgs.filter(
            (m) => !(m._id.startsWith('temp-') && m.content === msg.content && m.senderId === msg.senderId),
          );
          return [...filtered, msg];
        });
        this.scrollToBottom();
        // Mark as read
        this.wsService.send('markRead', { conversationId: this.conversationId });
      }
    });

    const typingSub = this.wsService.on('userTyping').subscribe((data) => {
      const typingData = data as { conversationId: string; userId: string };
      if (typingData.conversationId === this.conversationId && typingData.userId !== this.currentUserId()) {
        this.typingIndicator.set(true);
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.typingIndicator.set(false), 3000);
      }
    });

    const readSub = this.wsService.on('messagesRead').subscribe((data) => {
      const readData = data as { conversationId: string };
      if (readData.conversationId === this.conversationId) {
        this.messages.update((msgs) => msgs.map((m) => ({ ...m, isRead: true })));
      }
    });

    this.subscriptions.push(msgSub, typingSub, readSub);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
