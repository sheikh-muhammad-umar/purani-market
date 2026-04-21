import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { MessagingService } from '../../../core/services/messaging.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/auth';
import { Conversation } from '../../../core/models';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

@Component({
  selector: 'app-messaging-layout',
  standalone: true,
  imports: [CommonModule, ChatWindowComponent],
  templateUrl: './messaging-layout.component.html',
  styleUrls: ['./messaging-layout.component.scss'],
})
export class MessagingLayoutComponent implements OnInit, OnDestroy {
  conversations = signal<Conversation[]>([]);
  unreadCounts = signal<Record<string, number>>({});
  loading = signal(true);
  selectedConversationId = signal<string | null>(null);

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

    // Check if a conversation ID is in the URL
    this.subs.push(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          const match = e.url.match(/\/messaging\/([a-f0-9]+)/);
          if (match) {
            this.selectedConversationId.set(match[1]);
          }
        }),
    );

    // Initial check
    const url = this.router.url;
    const match = url.match(/\/messaging\/([a-f0-9]+)/);
    if (match) {
      this.selectedConversationId.set(match[1]);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  selectConversation(id: string): void {
    this.selectedConversationId.set(id);
    // Mark as read
    this.messagingService.markAsRead(id).subscribe();
  }

  getListingTitle(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.title) return pid.title;
    return 'Listing';
  }

  getListingImage(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.images?.length) {
      return pid.images[0].thumbnailUrl || pid.images[0].url || 'assets/placeholder.png';
    }
    return 'assets/placeholder.png';
  }

  getListingPrice(conversation: any): string {
    const pid = conversation.productListingId;
    if (typeof pid === 'object' && pid?.price) {
      return 'PKR ' + Number(pid.price.amount).toLocaleString();
    }
    return '';
  }

  getTimeAgo(date: Date): string {
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

  getUnreadCount(id: string): number {
    return this.unreadCounts()[id] || 0;
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
