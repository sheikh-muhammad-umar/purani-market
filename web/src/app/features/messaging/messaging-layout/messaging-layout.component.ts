import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Conversation, ConversationListing } from '../../../core/models';
import { PLACEHOLDER_IMAGE, CURRENCY_SYMBOL } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';
import { SKELETON_ITEMS } from '../messaging.constants';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

/** Precomputed view data for a single conversation row. */
interface ConversationView {
  title: string;
  image: string;
  price: string;
  timeAgo: string;
}

@Component({
  selector: 'app-messaging-layout',
  standalone: true,
  imports: [CommonModule, ChatWindowComponent],
  templateUrl: './messaging-layout.component.html',
  styleUrls: ['./messaging-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.chat-open]': 'selectedConversationId()',
  },
})
export class MessagingLayoutComponent implements OnInit, OnDestroy {
  conversations = signal<Conversation[]>([]);
  unreadCounts = signal<Record<string, number>>({});
  loading = signal(true);
  selectedConversationId = signal<string | null>(null);
  readonly SKELETON_ITEMS = SKELETON_ITEMS;

  /**
   * Precomputed view map — recalculated only when conversations signal changes,
   * NOT on every change detection cycle like template method calls would.
   */
  readonly conversationViews = computed<Record<string, ConversationView>>(() => {
    const convs = this.conversations();
    const views: Record<string, ConversationView> = {};
    for (const conv of convs) {
      views[conv._id] = {
        title: this.extractListingTitle(conv),
        image: this.extractListingImage(conv),
        price: this.extractListingPrice(conv),
        timeAgo: this.computeTimeAgo(conv.lastMessageAt),
      };
    }
    return views;
  });

  private subs: Subscription[] = [];

  constructor(
    private readonly messagingService: MessagingService,
    private readonly wsService: WebSocketService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadConversations();

    const userId = this.authService.user()?._id;
    if (userId) this.wsService.connect(userId);

    this.subs.push(
      this.wsService.on('newMessage').subscribe(() => {
        this.loadConversations();
      }),
    );

    // React to route param changes (handles initial load, navigation, and browser back/forward)
    this.subs.push(
      this.route.paramMap.subscribe((params) => {
        this.selectedConversationId.set(params.get('id'));
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  selectConversation(id: string): void {
    this.selectedConversationId.set(id);
    this.router.navigateByUrl(ROUTES.MESSAGING_CHAT(id), { replaceUrl: true });
    this.messagingService.markAsRead(id).subscribe();
  }

  deselectConversation(): void {
    this.selectedConversationId.set(null);
    this.router.navigateByUrl(ROUTES.MESSAGING, { replaceUrl: true });
  }

  // --- Private extraction helpers (called only from computed, not template) ---

  private extractListingTitle(conversation: Conversation): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && (pid as ConversationListing)?.title) {
      return (pid as ConversationListing).title;
    }
    return 'Listing';
  }

  private extractListingImage(conversation: Conversation): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object') {
      const listing = pid as ConversationListing;
      if (listing?.images?.length) {
        return listing.images[0].thumbnailUrl || listing.images[0].url || PLACEHOLDER_IMAGE;
      }
    }
    return PLACEHOLDER_IMAGE;
  }

  private extractListingPrice(conversation: Conversation): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object') {
      const listing = pid as ConversationListing;
      if (listing?.price) {
        return CURRENCY_SYMBOL + ' ' + Number(listing.price.amount).toLocaleString();
      }
    }
    return '';
  }

  private computeTimeAgo(date: Date): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString();
  }

  private loadConversations(): void {
    this.messagingService.getConversations().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res.data ?? []);
        this.conversations.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.messagingService.getUnreadPerConversation().subscribe({
      next: (counts) => this.unreadCounts.set(counts),
    });
  }
}
