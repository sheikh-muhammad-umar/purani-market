import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Conversation, ConversationListing } from '../../../core/models';
import { ListingStatus } from '../../../core/constants/enums';
import { CURRENCY_SYMBOL, PLACEHOLDER_IMAGE } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { CONVERSATION_SKELETON_ITEMS, LISTING_STATUS_LABELS } from '../messaging.constants';
import { ConversationView } from '../interfaces/conversation-view.interface';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss'],
})
export class ConversationListComponent implements OnInit, OnDestroy {
  readonly ROUTES = ROUTES;
  readonly SKELETON_ITEMS = CONVERSATION_SKELETON_ITEMS;

  readonly conversations = signal<Conversation[]>([]);
  readonly unreadCounts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Precomputed view models — recalculated only when conversations or unreadCounts change. */
  readonly conversationViews = computed(() => this.conversations().map((c) => this.toView(c)));

  private wsSub: Subscription | null = null;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const listingId = this.route.snapshot.queryParamMap.get('listingId');
    if (listingId) {
      this.initiateChat(listingId);
    } else {
      this.loadConversations();
    }
    const userId = this.authService.user()?._id ?? '';
    if (userId) {
      this.wsService.connect(userId);
    }
    this.wsSub = this.wsService.on('newMessage').subscribe((data) => {
      this.handleNewMessage(data as { conversationId: string; content: string; createdAt: string });
    });
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  // ─── Private ──────────────────────────────────────────────

  private initiateChat(listingId: string): void {
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const conversations = Array.isArray(res) ? res : (res.data ?? []);
        const existing = conversations.find((c: Conversation) => {
          const pid =
            typeof c.productListingId === 'object' ? c.productListingId._id : c.productListingId;
          return pid === listingId;
        });
        if (existing) {
          this.router.navigate([ROUTES.MESSAGING, existing._id]);
        } else {
          this.messagingService
            .startConversation({
              productListingId: listingId,
              message: "Hi, I'm interested in this listing.",
            })
            .subscribe({
              next: (conversation: any) => {
                const convId = conversation?.conversation?._id || conversation?._id;
                this.router.navigate([ROUTES.MESSAGING, convId]);
              },
              error: () => {
                this.error.set('Failed to start conversation');
                this.loading.set(false);
              },
            });
        }
      },
      error: () => {
        this.error.set('Failed to load conversations');
        this.loading.set(false);
      },
    });
  }

  private loadConversations(): void {
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const conversations = Array.isArray(res) ? res : (res.data ?? []);
        this.conversations.set(conversations);
        this.loading.set(false);

        this.messagingService.getUnreadPerConversation().subscribe({
          next: (counts) => this.unreadCounts.set(counts),
        });
      },
      error: () => {
        this.error.set('Failed to load conversations');
        this.loading.set(false);
      },
    });
  }

  private handleNewMessage(data: {
    conversationId: string;
    content: string;
    createdAt: string;
  }): void {
    const updated = this.conversations().map((c) =>
      c._id === data.conversationId
        ? { ...c, lastMessagePreview: data.content, lastMessageAt: new Date(data.createdAt) }
        : c,
    );
    updated.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    this.conversations.set(updated);

    this.messagingService.getUnreadPerConversation().subscribe({
      next: (counts) => this.unreadCounts.set(counts),
    });
  }

  /** Map a Conversation to a flat view model (called once per signal change, not per CD cycle). */
  private toView(conv: Conversation): ConversationView {
    const listing =
      typeof conv.productListingId === 'object'
        ? (conv.productListingId as ConversationListing)
        : null;

    const status = listing?.status ?? ListingStatus.ACTIVE;
    const isActive = status === ListingStatus.ACTIVE;

    return {
      id: conv._id,
      routerLink: ROUTES.MESSAGING_CHAT(conv._id),
      title: listing?.title ?? this.fallbackTitle(conv.productListingId),
      price: listing?.price
        ? `${CURRENCY_SYMBOL} ${Number(listing.price.amount).toLocaleString()}`
        : '',
      image: listing?.images?.[0]?.thumbnailUrl || listing?.images?.[0]?.url || PLACEHOLDER_IMAGE,
      status,
      statusLabel: isActive
        ? ''
        : (LISTING_STATUS_LABELS[status as ListingStatus] ?? 'Unavailable'),
      isActive,
      timeAgo: this.formatTimeAgo(conv.lastMessageAt),
      preview: conv.lastMessagePreview || 'No messages yet',
      unreadCount: this.unreadCounts()[conv._id] || 0,
    };
  }

  private fallbackTitle(pid: string | ConversationListing): string {
    const id = typeof pid === 'string' ? pid : (pid?._id ?? '');
    return 'Listing #' + id.slice(0, 8);
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }
}
