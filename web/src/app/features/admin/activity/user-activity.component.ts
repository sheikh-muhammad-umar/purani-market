import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

interface ActivityEntry {
  _id: string;
  userId: string;
  action: string;
  productListingId?: string;
  searchQuery?: string;
  categoryId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

@Component({
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './user-activity.component.html',
  styleUrl: './user-activity.component.scss',
})
export class UserActivityComponent implements OnInit {
  readonly loading = signal(false);
  readonly activities = signal<ActivityEntry[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);

  filterUserId = '';
  filterAction = '';
  filterDateFrom = '';
  filterDateTo = '';
  sortBy = 'newest';
  page = 1;
  filtersOpen = false;

  readonly actionOptions: SelectOption[] = [
    { value: '', label: 'All Actions' },
    { value: 'view', label: 'View Listing' },
    { value: 'search', label: 'Search' },
    { value: 'category_browse', label: 'Category Browse' },
    { value: 'page_view', label: 'Page View' },
    { value: 'favorite', label: 'Favorite' },
    { value: 'unfavorite', label: 'Unfavorite' },
    { value: 'contact', label: 'Contact' },
    { value: 'listing_create', label: 'Listing Create' },
    { value: 'listing_edit', label: 'Listing Edit' },
    { value: 'listing_delete', label: 'Listing Delete' },
    { value: 'listing_status_change', label: 'Status Change' },
    { value: 'listing_feature', label: 'Feature Ad' },
    { value: 'login', label: 'Login' },
    { value: 'register', label: 'Register' },
    { value: 'logout', label: 'Logout' },
    { value: 'message_sent', label: 'Message Sent' },
    { value: 'conversation_start', label: 'Conversation Start' },
    { value: 'package_purchase', label: 'Package Purchase' },
    { value: 'payment_attempt', label: 'Payment Attempt' },
    { value: 'location_change', label: 'Location Change' },
  ];

  readonly sortOptions: SelectOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ];

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.loadActivity();
  }

  loadActivity(): void {
    this.loading.set(true);
    const [sort, order] = this.sortBy === 'oldest'
      ? ['createdAt', 'asc' as const]
      : ['createdAt', 'desc' as const];

    this.adminService.getAllActivity({
      page: this.page,
      limit: 50,
      action: this.filterAction || undefined,
      userId: this.filterUserId.trim() || undefined,
      dateFrom: this.filterDateFrom || undefined,
      dateTo: this.filterDateTo || undefined,
      sort,
      order,
    }).subscribe({
      next: (res: any) => {
        this.activities.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.totalPages.set(res.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.activities.set([]);
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadActivity();
  }

  resetFilters(): void {
    this.filterUserId = '';
    this.filterAction = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.sortBy = 'newest';
    this.page = 1;
    this.loadActivity();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page = p;
    this.loadActivity();
  }

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      view: 'visibility', search: 'search', category_browse: 'category',
      page_view: 'web', favorite: 'favorite', unfavorite: 'heart_broken',
      contact: 'call', share: 'share', listing_create: 'add_circle',
      listing_edit: 'edit', listing_delete: 'delete',
      listing_status_change: 'swap_horiz', listing_feature: 'star',
      login: 'login', register: 'person_add', logout: 'logout',
      message_sent: 'send', conversation_start: 'chat',
      package_purchase: 'shopping_cart', payment_attempt: 'payment',
      location_change: 'location_on', dismiss: 'close',
      recommendation_click: 'recommend',
    };
    return icons[action] || 'info';
  }

  getMetadataKeys(metadata: Record<string, any>): string[] {
    return Object.keys(metadata).filter(
      k => k !== 'ip' && k !== 'userAgent' && metadata[k] != null,
    );
  }
}
