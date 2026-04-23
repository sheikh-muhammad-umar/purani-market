import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, PendingListing } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import {
  CONDITION_FILTER_OPTIONS,
  REVIEW_COUNT_OPTIONS,
} from '../../../core/constants/select-options';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent, DatePickerComponent],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.scss'],
})
export class ModerationQueueComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly listings = signal<PendingListing[]>([]);
  readonly totalListings = signal(0);
  readonly actionLoading = signal<string | null>(null);

  rejectingId: string | null = null;
  expandedId: string | null = null;
  selectedRejectReasonIds: Record<string, string[]> = {};
  rejectCustomNote: Record<string, string> = {};
  availableReasons: { _id: string; title: string; description?: string }[] = [];

  // Sorting
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  searchQuery = '';

  // Filters
  filterCondition = '';
  filterCategory = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterReviewCount = '';
  filtersOpen = false;

  conditionOptions = CONDITION_FILTER_OPTIONS;

  reviewCountOptions = REVIEW_COUNT_OPTIONS;

  categoryOptions: SelectOption[] = [{ value: '', label: 'All Categories' }];

  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
  ) {}

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  ngOnInit(): void {
    this.loadPendingListings();
    this.loadCategories();
    this.loadRejectionReasons();
  }

  loadRejectionReasons(): void {
    this.adminService.getRejectionReasons().subscribe({
      next: (reasons) => {
        this.availableReasons = reasons;
      },
    });
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats: Category[]) => {
        this.categoryOptions = [
          { value: '', label: 'All Categories' },
          ...cats.map((c) => ({ value: c._id, label: c.name })),
        ];
      },
    });
  }

  loadPendingListings(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService.getPendingListings().subscribe({
      next: (res: any) => {
        const data = res && res.data && res.statusCode ? res.data : res;
        const listings = data.listings ?? data.data ?? [];
        const sorted = [...listings].sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        this.listings.set(sorted);
        this.totalListings.set(data.total ?? sorted.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load pending listings. Please try again.');
        this.loading.set(false);
      },
    });
  }

  approveListing(listing: PendingListing): void {
    this.actionLoading.set(listing._id);
    this.adminService.approveListing(listing._id).subscribe({
      next: () => {
        this.listings.update((list) => list.filter((l) => l._id !== listing._id));
        this.totalListings.update((t) => t - 1);
        this.actionLoading.set(null);
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }

  startReject(listing: PendingListing): void {
    this.rejectingId = listing._id;
    this.expandedId = listing._id;
    if (!this.selectedRejectReasonIds[listing._id]) {
      this.selectedRejectReasonIds[listing._id] = [];
    }
    if (!this.rejectCustomNote[listing._id]) {
      this.rejectCustomNote[listing._id] = '';
    }
    // Scroll to the reject form after DOM updates
    setTimeout(() => {
      const el = document.getElementById('reject-form-' + listing._id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  cancelReject(): void {
    this.rejectingId = null;
  }

  toggleRejectReason(listingId: string, reasonId: string): void {
    const list = this.selectedRejectReasonIds[listingId] || [];
    const idx = list.indexOf(reasonId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(reasonId);
    }
    this.selectedRejectReasonIds[listingId] = [...list];
  }

  confirmReject(listing: PendingListing): void {
    const reasons = this.selectedRejectReasonIds[listing._id];
    if (!reasons || reasons.length === 0) return;
    this.actionLoading.set(listing._id);
    const payload = {
      rejectionReasonIds: reasons,
      customNote: (this.rejectCustomNote[listing._id] || '').trim() || undefined,
    };
    this.adminService.rejectListing(listing._id, payload).subscribe({
      next: () => {
        this.listings.update((list) => list.filter((l) => l._id !== listing._id));
        this.totalListings.update((t) => t - 1);
        this.rejectingId = null;
        delete this.selectedRejectReasonIds[listing._id];
        delete this.rejectCustomNote[listing._id];
        this.actionLoading.set(null);
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }

  getThumbnail(listing: PendingListing): string {
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailUrl || listing.images[0].url;
    }
    return '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  }

  formatPrice(listing: PendingListing): string {
    if (!listing.price) return '—';
    return `${listing.price.currency} ${listing.price.amount.toLocaleString()}`;
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).filter((k) => obj[k] !== '' && obj[k] !== null && obj[k] !== undefined);
  }

  formatAttrKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  sortListings(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.listings.update((list) =>
      [...list].sort((a: any, b: any) => {
        let va = col === 'price' ? a.price?.amount : a[col];
        let vb = col === 'price' ? b.price?.amount : b[col];
        if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  sortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  clearFilters(): void {
    this.filterCondition = '';
    this.filterCategory = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterReviewCount = '';
    this.searchQuery = '';
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.filterCondition ||
      this.filterCategory ||
      this.filterDateFrom ||
      this.filterDateTo ||
      this.filterReviewCount ||
      this.searchQuery
    );
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterCondition) count++;
    if (this.filterCategory) count++;
    if (this.filterDateFrom || this.filterDateTo) count++;
    if (this.filterReviewCount) count++;
    if (this.searchQuery) count++;
    return count;
  }

  get filteredListings(): PendingListing[] {
    let result = this.listings();

    // Text search
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.sellerEmail?.toLowerCase().includes(q) ||
          l.sellerName?.toLowerCase().includes(q),
      );
    }

    // Condition filter
    if (this.filterCondition) {
      result = result.filter((l) => l.condition === this.filterCondition);
    }

    // Category filter
    if (this.filterCategory) {
      result = result.filter((l) => l.categoryId === this.filterCategory);
    }

    // Date range filter
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom + 'T00:00:00').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() >= from);
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo + 'T23:59:59').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() <= to);
    }

    // Review count filter
    if (this.filterReviewCount !== '') {
      const count = parseInt(this.filterReviewCount, 10);
      result = result.filter((l) => (l.rejectionCount || 0) === count);
    }

    return result;
  }
}
