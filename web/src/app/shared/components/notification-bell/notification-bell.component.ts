import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import { ROUTES } from '../../../core/constants/routes';
import { NotificationCountService } from '../../../core/services/notification-count.service';
import {
  UserNotification,
  UserNotificationResponse,
} from '../../../core/models/notification.model';
import {
  getCategoryMeta,
  NotificationCategoryMeta,
} from '../../../core/constants/notification-categories';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  exportAs: 'notificationBell',
})
export class NotificationBellComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly countService = inject(NotificationCountService);

  open = signal(false);
  expandedId = signal<string | null>(null);
  notifications = signal<UserNotification[]>([]);

  /** Precomputed category metadata per notification — avoids function calls in template */
  categoryMetaMap = computed(() => {
    const map = new Map<string, NotificationCategoryMeta>();
    for (const n of this.notifications()) {
      if (!map.has(n.category)) {
        map.set(n.category, getCategoryMeta(n.category));
      }
    }
    return map;
  });

  readonly unreadCount = this.countService.unreadCount;

  private readonly destroyRef = inject(DestroyRef);
  private readonly elRef = inject(ElementRef);
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.countService.start();
    this.loadNotifications();

    // Listen for polling refresh requests — reuse the same loadNotifications
    // call so we get both the dropdown data and the unread count in one request
    this.countService.refreshRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadNotifications());
  }

  toggle(): void {
    this.open.update((v) => !v);
    this.expandedId.set(null);
    if (this.open()) {
      this.loadNotifications();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.open.set(false);
      this.expandedId.set(null);
    }
  }

  selectNotification(notification: UserNotification): void {
    if (this.expandedId() === notification._id) {
      this.expandedId.set(null);
    } else {
      this.expandedId.set(notification._id);
      this.markAsRead(notification);
    }
  }

  /**
   * Deep link for a notification based on its data payload, or null when there
   * is nowhere useful to go. Shorts notifications open the short; listing
   * notifications open the listing.
   */
  notificationLink(notification: UserNotification): string | null {
    const data = notification.data;
    if (!data) return null;
    if (data.shortId) return ROUTES.SHORTS;
    if (data.listingId) return `${ROUTES.LISTINGS}/${data.listingId}`;
    return null;
  }

  notificationQueryParams(notification: UserNotification): Record<string, string> | null {
    const data = notification.data;
    if (data?.shortId) return { id: data.shortId };
    return null;
  }

  hasLink(notification: UserNotification): boolean {
    return this.notificationLink(notification) !== null;
  }

  closeDropdown(): void {
    this.open.set(false);
    this.expandedId.set(null);
  }

  markAsRead(notification: UserNotification): void {
    if (notification.read) return;
    this.http
      .patch(`${this.apiUrl}${API.NOTIFICATION_READ(notification._id)}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        notification.read = true;
        this.countService.setCount(Math.max(0, this.countService.unreadCount() - 1));
      });
  }

  markAllAsRead(): void {
    this.http
      .post(`${this.apiUrl}${API.NOTIFICATIONS_READ_ALL}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
        this.countService.setCount(0);
      });
  }

  private loadNotifications(): void {
    const params = new HttpParams().set('page', '1').set('limit', PAGE_SIZE.toString());

    this.http
      .get<UserNotificationResponse>(`${this.apiUrl}${API.NOTIFICATIONS}`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.notifications.set(res.data);
          this.countService.setCount(res.unreadCount);
        },
        error: () => {},
      });
  }
}
