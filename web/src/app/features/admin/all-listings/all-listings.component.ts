import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AdminService, PendingListing } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { Category } from '../../../core/models/category.model';
import { saveState, loadState } from '../../../core/utils/state-persistence';
import { ListingStatus } from '../../../core/constants/enums';
import { PAGE_SIZE_DEFAULT } from '../../../core/constants/app';
import {
  CONDITION_FILTER_OPTIONS,
  REVIEW_COUNT_OPTIONS,
} from '../../../core/constants/select-options';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { buildMapEmbedUrl } from '../../../core/utils/map-link';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';

interface AdminListing {
  _id: string;
  title: string;
  status: string;
  sellerName: string;
  categoryName: string;
  price?: { amount: number; currency: string };
  location?: { city?: string; area?: string; province?: string };
  images?: { url: string; thumbnailUrl?: string }[];
  createdAt: string;
  deletedAt?: string;
  deletionReason?: string;
  rejectionReason?: string;
  rejectionCount?: number;
  isFeatured?: boolean;
  viewCount?: number;
}

@Component({
  selector: 'app-all-listings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomSelectComponent, DatePickerComponent],
  templateUrl: './all-listings.component.html',
  styleUrl: './all-listings.component.scss',
})
export class AllListingsComponent implements OnInit {
  // --- Tab state ---
  activeTab = signal<'all' | 'moderation'>('all');

  // --- All Listings state ---
  readonly loading = signal(true);
  readonly listings = signal<AdminListing[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);

  searchQuery = '';
  filterStatus = '';
  filterCategory = '';
  filterProvince = '';
  filterCity = '';
  filterRejectionReason = '';
  filterDeletionReason = '';
  filterDateFrom = '';
  filterDateTo = '';
  readonly today = new Date().toISOString().split('T')[0];
  sortBy = 'newest';
  page = 1;
  filtersOpen = false;

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'sold', label: 'Sold' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'expired', label: 'Expired' },
    { value: 'deleted', label: 'Deleted' },
  ];

  readonly sortOptions: SelectOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price_high', label: 'Price: High → Low' },
    { value: 'price_low', label: 'Price: Low → High' },
    { value: 'views', label: 'Most Viewed' },
  ];

  categoryOptions: SelectOption[] = [{ value: '', label: 'All Categories' }];
  provinceOptions: SelectOption[] = [{ value: '', label: 'All Provinces' }];
  cityOptions: SelectOption[] = [{ value: '', label: 'All Cities' }];
  rejectionReasonOptions: SelectOption[] = [{ value: '', label: 'All' }];
  deletionReasonOptions: SelectOption[] = [{ value: '', label: 'All' }];

  get hasActiveFilters(): boolean {
    return !!(
      this.filterStatus ||
      this.filterCategory ||
      this.filterProvince ||
      this.filterCity ||
      this.filterRejectionReason ||
      this.filterDeletionReason ||
      this.filterDateFrom ||
      this.filterDateTo ||
      this.searchQuery
    );
  }
  get activeFilterCount(): number {
    let c = 0;
    if (this.filterStatus) c++;
    if (this.filterCategory) c++;
    if (this.filterProvince || this.filterCity) c++;
    if (this.filterRejectionReason) c++;
    if (this.filterDeletionReason) c++;
    if (this.filterDateFrom || this.filterDateTo) c++;
    if (this.searchQuery) c++;
    return c;
  }

  // --- Moderation Queue state ---
  readonly pendingListings = signal<PendingListing[]>([]);
  readonly pendingCount = signal(0);
  readonly modLoading = signal(true);
  readonly modError = signal<string | null>(null);
  readonly modTotalListings = signal(0);
  readonly modActionLoading = signal<string | null>(null);
  readonly bulkProcessing = signal(false);

  // Bulk selection
  selectedIds = new Set<string>();

  rejectingId: string | null = null;
  expandedId: string | null = null;
  selectedRejectReasonIds: Record<string, string[]> = {};
  rejectCustomNote: Record<string, string> = {};
  availableReasons: { _id: string; title: string; description?: string }[] = [];

  // Moderation sorting
  modSortCol = '';
  modSortDir: 'asc' | 'desc' = 'asc';
  modSearchQuery = '';

  // Moderation filters
  modFilterCondition = '';
  modFilterCategory = '';
  modFilterDateFrom = '';
  modFilterDateTo = '';
  modFilterReviewCount = '';
  modFiltersOpen = false;

  conditionOptions = CONDITION_FILTER_OPTIONS;
  reviewCountOptions = REVIEW_COUNT_OPTIONS;
  modCategoryOptions: SelectOption[] = [{ value: '', label: 'All Categories' }];

  get modHasActiveFilters(): boolean {
    return !!(
      this.modFilterCondition ||
      this.modFilterCategory ||
      this.modFilterDateFrom ||
      this.modFilterDateTo ||
      this.modFilterReviewCount ||
      this.modSearchQuery
    );
  }

  get modActiveFilterCount(): number {
    let count = 0;
    if (this.modFilterCondition) count++;
    if (this.modFilterCategory) count++;
    if (this.modFilterDateFrom || this.modFilterDateTo) count++;
    if (this.modFilterReviewCount) count++;
    if (this.modSearchQuery) count++;
    return count;
  }

  get filteredPendingListings(): PendingListing[] {
    let result = this.pendingListings();

    // Text search
    const q = this.modSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.sellerEmail?.toLowerCase().includes(q) ||
          l.sellerName?.toLowerCase().includes(q),
      );
    }

    // Condition filter
    if (this.modFilterCondition) {
      result = result.filter((l) => l.condition === this.modFilterCondition);
    }

    // Category filter
    if (this.modFilterCategory) {
      result = result.filter((l) => l.categoryId === this.modFilterCategory);
    }

    // Date range filter
    if (this.modFilterDateFrom) {
      const from = new Date(this.modFilterDateFrom + 'T00:00:00').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() >= from);
    }
    if (this.modFilterDateTo) {
      const to = new Date(this.modFilterDateTo + 'T23:59:59').getTime();
      result = result.filter((l) => new Date(l.createdAt).getTime() <= to);
    }

    // Review count filter
    if (this.modFilterReviewCount !== '') {
      const count = parseInt(this.modFilterReviewCount, 10);
      result = result.filter((l) => (l.rejectionCount || 0) === count);
    }

    return result;
  }

  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  private readonly stateKey = 'admin-all-listings';
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    // Check if navigated with ?tab=moderation
    const tab = this.route.snapshot.queryParams['tab'];
    if (tab === 'moderation') {
      this.activeTab.set('moderation');
    }

    const saved = loadState<{ filterStatus: string; sortBy: string; page: number }>(this.stateKey);
    if (saved.filterStatus) this.filterStatus = saved.filterStatus;
    if (saved.sortBy) this.sortBy = saved.sortBy;
    if (saved.page) this.page = saved.page;

    this.loadListings();
    this.loadCategories();
    this.loadProvinces();
    this.loadRejectionReasons();
    this.loadDeletionReasons();
    this.loadPendingListings();
    this.loadModerationRejectionReasons();
  }

  // --- Tab switching ---
  switchTab(tab: 'all' | 'moderation'): void {
    this.activeTab.set(tab);
    if (tab === 'moderation' && this.pendingListings().length === 0 && !this.modLoading()) {
      this.loadPendingListings();
    }
  }

  // --- All Listings methods ---
  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.categoryOptions = [
          { value: '', label: 'All Categories' },
          ...cats.map((c) => ({ value: c._id, label: c.name })),
        ];
        this.modCategoryOptions = [
          { value: '', label: 'All Categories' },
          ...cats.map((c) => ({ value: c._id, label: c.name })),
        ];
      },
    });
  }

  loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces: any[]) => {
        this.provinceOptions = [
          { value: '', label: 'All Provinces' },
          ...provinces.map((p: any) => ({ value: p._id, label: p.name })),
        ];
      },
    });
  }

  onProvinceChange(): void {
    this.filterCity = '';
    this.cityOptions = [{ value: '', label: 'All Cities' }];
    if (this.filterProvince) {
      this.locationService.getCities(this.filterProvince).subscribe({
        next: (cities: any[]) => {
          this.cityOptions = [
            { value: '', label: 'All Cities' },
            ...cities.map((c: any) => ({ value: c._id, label: c.name })),
          ];
        },
      });
    }
    this.applyFilters();
  }

  loadRejectionReasons(): void {
    this.adminService.getRejectionReasons(true).subscribe({
      next: (reasons) => {
        this.rejectionReasonOptions = [
          { value: '', label: 'All' },
          ...reasons.map((r: any) => ({ value: r.title, label: r.title })),
        ];
      },
    });
  }

  loadDeletionReasons(): void {
    this.adminService.getDeletionReasons(true).subscribe({
      next: (reasons) => {
        this.deletionReasonOptions = [
          { value: '', label: 'All' },
          ...reasons.map((r: any) => ({ value: r.title, label: r.title })),
        ];
      },
    });
  }

  loadListings(): void {
    this.loading.set(true);
    const sortMap: Record<string, { sort: string; order: 'asc' | 'desc' }> = {
      newest: { sort: 'createdAt', order: 'desc' },
      oldest: { sort: 'createdAt', order: 'asc' },
      price_high: { sort: 'price.amount', order: 'desc' },
      price_low: { sort: 'price.amount', order: 'asc' },
      views: { sort: 'viewCount', order: 'desc' },
    };
    const { sort, order } = sortMap[this.sortBy] || sortMap['newest'];

    this.adminService
      .getAllListings({
        page: this.page,
        limit: PAGE_SIZE_DEFAULT,
        search: this.searchQuery.trim() || undefined,
        status: this.filterStatus || undefined,
        categoryId: this.filterCategory || undefined,
        provinceId: this.filterProvince || undefined,
        cityId: this.filterCity || undefined,
        rejectionReason: this.filterRejectionReason || undefined,
        deletionReason: this.filterDeletionReason || undefined,
        dateFrom: this.filterDateFrom || undefined,
        dateTo: this.filterDateTo || undefined,
        sort,
        order,
      })
      .subscribe({
        next: (res: any) => {
          this.listings.set(res.data ?? []);
          this.total.set(res.total ?? 0);
          this.totalPages.set(res.totalPages ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.listings.set([]);
          this.loading.set(false);
        },
      });
  }

  private persistState(): void {
    saveState(this.stateKey, {
      filterStatus: this.filterStatus,
      sortBy: this.sortBy,
      page: this.page,
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.persistState();
    this.loadListings();
  }
  clearFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterCategory = '';
    this.filterProvince = '';
    this.filterCity = '';
    this.filterRejectionReason = '';
    this.filterDeletionReason = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.sortBy = 'newest';
    this.cityOptions = [{ value: '', label: 'All Cities' }];
    this.page = 1;
    saveState(this.stateKey, {});
    this.loadListings();
  }
  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page = p;
    this.persistState();
    this.loadListings();
  }

  formatDate(d: string): string {
    return d
      ? new Date(d).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—';
  }
  formatPrice(l: AdminListing | PendingListing): string {
    return l.price ? `${l.price.currency} ${l.price.amount.toLocaleString()}` : '—';
  }

  private static readonly STATUS_COLOR_MAP: Record<string, string> = {
    [ListingStatus.ACTIVE]: '#00B894',
    [ListingStatus.PENDING_REVIEW]: '#F39C12',
    [ListingStatus.REJECTED]: '#E74C3C',
    [ListingStatus.SOLD]: '#6C5CE7',
    [ListingStatus.INACTIVE]: '#636e72',
    [ListingStatus.EXPIRED]: '#F39C12',
    [ListingStatus.DELETED]: '#E74C3C',
  };

  getStatusColor(status: string): string {
    return AllListingsComponent.STATUS_COLOR_MAP[status] || '#636e72';
  }

  // --- Moderation Queue methods ---
  loadModerationRejectionReasons(): void {
    this.adminService.getRejectionReasons().subscribe({
      next: (reasons) => {
        this.availableReasons = reasons;
      },
    });
  }

  loadPendingListings(): void {
    this.modLoading.set(true);
    this.modError.set(null);
    this.adminService.getPendingListings().subscribe({
      next: (res: any) => {
        const data = res && res.data && res.statusCode ? res.data : res;
        const listings = data.listings ?? data.data ?? [];
        const sorted = [...listings].sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        this.pendingListings.set(sorted);
        this.modTotalListings.set(data.total ?? sorted.length);
        this.pendingCount.set(data.total ?? sorted.length);
        this.modLoading.set(false);
      },
      error: () => {
        this.modError.set(ERROR_MSG.PENDING_LISTINGS_LOAD_FAILED);
        this.modLoading.set(false);
      },
    });
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  approveListing(listing: PendingListing): void {
    this.modActionLoading.set(listing._id);
    this.adminService.approveListing(listing._id).subscribe({
      next: () => {
        this.pendingListings.update((list) => list.filter((l) => l._id !== listing._id));
        this.modTotalListings.update((t) => t - 1);
        this.pendingCount.update((c) => c - 1);
        this.modActionLoading.set(null);
      },
      error: () => {
        this.modActionLoading.set(null);
      },
    });
  }

  // --- Bulk Actions ---
  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  toggleSelectAll(): void {
    const pending = this.filteredPendingListings;
    if (this.selectedIds.size === pending.length) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(pending.map((l) => l._id));
    }
  }

  get allSelected(): boolean {
    const pending = this.filteredPendingListings;
    return pending.length > 0 && this.selectedIds.size === pending.length;
  }

  bulkApprove(): void {
    if (this.selectedIds.size === 0) return;
    this.bulkProcessing.set(true);
    const ids = Array.from(this.selectedIds);
    let completed = 0;

    for (const id of ids) {
      this.adminService.approveListing(id).subscribe({
        next: () => {
          completed++;
          this.pendingListings.update((list) => list.filter((l) => l._id !== id));
          this.pendingCount.update((c) => c - 1);
          this.modTotalListings.update((t) => t - 1);
          if (completed === ids.length) {
            this.selectedIds = new Set();
            this.bulkProcessing.set(false);
          }
        },
        error: () => {
          completed++;
          if (completed === ids.length) {
            this.selectedIds = new Set();
            this.bulkProcessing.set(false);
          }
        },
      });
    }
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
    this.modActionLoading.set(listing._id);
    const payload = {
      rejectionReasonIds: reasons,
      customNote: (this.rejectCustomNote[listing._id] || '').trim() || undefined,
    };
    this.adminService.rejectListing(listing._id, payload).subscribe({
      next: () => {
        this.pendingListings.update((list) => list.filter((l) => l._id !== listing._id));
        this.modTotalListings.update((t) => t - 1);
        this.pendingCount.update((c) => c - 1);
        this.rejectingId = null;
        delete this.selectedRejectReasonIds[listing._id];
        delete this.rejectCustomNote[listing._id];
        this.modActionLoading.set(null);
      },
      error: () => {
        this.modActionLoading.set(null);
      },
    });
  }

  getThumbnail(listing: PendingListing): string {
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailUrl || listing.images[0].url;
    }
    return '';
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).filter((k) => obj[k] !== '' && obj[k] !== null && obj[k] !== undefined);
  }

  formatAttrKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private mapEmbedCache = new Map<string, SafeResourceUrl>();

  getMapEmbedUrl(mapLink: string): SafeResourceUrl {
    const cached = this.mapEmbedCache.get(mapLink);
    if (cached) return cached;

    const safe = this.sanitizer.bypassSecurityTrustResourceUrl(buildMapEmbedUrl(mapLink));
    this.mapEmbedCache.set(mapLink, safe);
    return safe;
  }

  sortModerationListings(col: string): void {
    if (this.modSortCol === col) {
      this.modSortDir = this.modSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.modSortCol = col;
      this.modSortDir = 'asc';
    }
    const dir = this.modSortDir === 'asc' ? 1 : -1;
    this.pendingListings.update((list) =>
      [...list].sort((a: any, b: any) => {
        let va = col === 'price' ? a.price?.amount : a[col];
        let vb = col === 'price' ? b.price?.amount : b[col];
        if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  modSortIcon(col: string): string {
    if (col !== this.modSortCol) return 'unfold_more';
    return this.modSortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  clearModFilters(): void {
    this.modFilterCondition = '';
    this.modFilterCategory = '';
    this.modFilterDateFrom = '';
    this.modFilterDateTo = '';
    this.modFilterReviewCount = '';
    this.modSearchQuery = '';
  }
}
