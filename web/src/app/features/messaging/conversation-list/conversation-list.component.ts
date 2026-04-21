import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Conversation } from '../../../core/models';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss'],
})
export class ConversationListComponent implements OnInit, OnDestroy {
  readonly conversations = signal<Conversation[]>([]);
  readonly unreadCounts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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

  private initiateChat(listingId: string): void {
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const conversations = Array.isArray(res) ? res : (res.data ?? []);
        const existing = conversations.find((c: any) => {
          const pid = c.productListingId?._id || c.productListingId;
          return pid === listingId;
        });
        if (existing) {
          this.router.navigate(['/messaging', existing._id]);
        } else {
          this.messagingService
            .startConversation({
              productListingId: listingId,
              message: "Hi, I'm interested in this listing.",
            })
            .subscribe({
              next: (conversation: any) => {
                const convId = conversation?.conversation?._id || conversation?._id;
                this.router.navigate(['/messaging', convId]);
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

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  getListingTitle(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.title) return pid.title;
    return (
      'Listing #' + (typeof pid === 'string' ? pid.slice(0, 8) : (pid?._id?.slice(0, 8) ?? ''))
    );
  }

  getListingPrice(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.price) {
      return (pid.price.currency || 'PKR') + ' ' + Number(pid.price.amount).toLocaleString();
    }
    return '';
  }

  getListingImage(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.images?.length) {
      return pid.images[0].thumbnailUrl || pid.images[0].url || 'assets/placeholder.png';
    }
    return 'assets/placeholder.png';
  }

  getTimeAgo(date: Date): string {
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

  private loadConversations(): void {
    this.messagingService.getConversations().subscribe({
      next: (res) => {
        const conversations = Array.isArray(res) ? res : (res.data ?? []);
        this.conversations.set(conversations);
        this.loading.set(false);

        // Fetch unread counts per conversation
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

  getUnreadCount(conversationId: string): number {
    return this.unreadCounts()[conversationId] || 0;
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

    // Refresh unread counts
    this.messagingService.getUnreadPerConversation().subscribe({
      next: (counts) => this.unreadCounts.set(counts),
    });
  }
}
