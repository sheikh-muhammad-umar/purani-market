import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ShortsService,
  ShortVideo,
  ShortsPackagePurchase,
} from '../../../core/services/shorts.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { FormatStatusPipe } from '../../../shared/pipes/format-status.pipe';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-shorts-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormatDurationPipe,
    FormatStatusPipe,
    CustomSelectComponent,
    DatePickerComponent,
    EmptyStateComponent,
    PaginationComponent,
    ModalComponent,
  ],
  templateUrl: './shorts-admin.component.html',
  styleUrl: './shorts-admin.component.scss',
})
export class ShortsAdminComponent implements OnInit {
  readonly activeTab = signal<'all' | 'moderation' | 'payments'>('all');
  readonly shorts = signal<ShortVideo[]>([]);
  readonly pendingShorts = signal<ShortVideo[]>([]);
  readonly pendingPurchases = signal<ShortsPackagePurchase[]>([]);
  readonly payLoading = signal(false);
  readonly payActionLoading = signal<string | null>(null);
  readonly loading = signal(true);
  readonly modLoading = signal(true);
  readonly total = signal(0);
  readonly pendingCount = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly rejectingShort = signal<ShortVideo | null>(null);
  readonly previewShort = signal<ShortVideo | null>(null);
  readonly modActionLoading = signal<string | null>(null);

  // All Shorts filters
  statusFilter = '';
  searchQuery = '';
  filterCategory = '';
  filterDateFrom = '';
  filterDateTo = '';
  readonly today = new Date().toISOString().split('T')[0];
  sortBy = 'newest';
  filtersOpen = false;
  limit = 20;

  // Moderation state
  rejectionReason = '';
  modSearchQuery = '';
  modSortCol = '';
  modSortDir: 'asc' | 'desc' = 'asc';

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'active', label: 'Active' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
  ];

  readonly sortOptions: SelectOption[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'views', label: 'Most Viewed' },
  ];

  categoryOptions: SelectOption[] = [{ value: '', label: 'All Categories' }];

  get hasActiveFilters(): boolean {
    return !!(
      this.statusFilter ||
      this.filterCategory ||
      this.filterDateFrom ||
      this.filterDateTo ||
      this.searchQuery
    );
  }

  get activeFilterCount(): number {
    let c = 0;
    if (this.statusFilter) c++;
    if (this.filterCategory) c++;
    if (this.filterDateFrom || this.filterDateTo) c++;
    if (this.searchQuery) c++;
    return c;
  }

  get filteredPendingShorts(): ShortVideo[] {
    let result = this.pendingShorts();
    const q = this.modSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q),
      );
    }
    return result;
  }

  constructor(
    private readonly shortsService: ShortsService,
    private readonly categoriesService: CategoriesService,
    private readonly confirmModal: ConfirmModalService,
    private readonly toast: ToastService,
  ) {}

  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParams['tab'];
    if (tab === 'moderation') {
      this.activeTab.set('moderation');
    }
    this.loadShorts();
    this.loadPendingShorts();
    this.loadCategories();
  }

  switchTab(tab: 'all' | 'moderation' | 'payments'): void {
    this.activeTab.set(tab);
    if (tab === 'moderation' && this.pendingShorts().length === 0 && !this.modLoading()) {
      this.loadPendingShorts();
    }
    if (tab === 'payments' && this.pendingPurchases().length === 0 && !this.payLoading()) {
      this.loadPendingPurchases();
    }
  }

  // --- Payments (manual shorts package confirmation) ---
  loadPendingPurchases(): void {
    this.payLoading.set(true);
    this.shortsService.adminListPurchases('pending').subscribe({
      next: (purchases) => {
        this.pendingPurchases.set(purchases);
        this.payLoading.set(false);
      },
      error: () => this.payLoading.set(false),
    });
  }

  async confirmPurchase(purchase: ShortsPackagePurchase): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Confirm Payment',
      message: `Confirm payment for this shorts package? This activates the seller's ${purchase.quantity} short(s) for ${purchase.duration} day(s).`,
      confirmText: 'Confirm Payment',
      variant: 'info',
    });
    if (!confirmed) return;

    this.payActionLoading.set(purchase._id);
    this.shortsService.adminConfirmPayment(purchase._id).subscribe({
      next: () => {
        this.pendingPurchases.update((list) => list.filter((p) => p._id !== purchase._id));
        this.payActionLoading.set(null);
        this.toast.success('Payment confirmed and package activated.');
      },
      error: () => {
        this.payActionLoading.set(null);
        this.toast.error('Failed to confirm payment.');
      },
    });
  }

  getPurchaseSellerName(purchase: ShortsPackagePurchase): string {
    const s = purchase.sellerId as any;
    if (s?.profile) return `${s.profile.firstName || ''} ${s.profile.lastName || ''}`.trim();
    return 'Unknown';
  }

  getPurchaseSellerContact(purchase: ShortsPackagePurchase): string {
    const s = purchase.sellerId as any;
    return s?.email || s?.phone || '';
  }

  getPurchasePackageName(purchase: ShortsPackagePurchase): string {
    const p = purchase.packageId as any;
    return p?.name || 'Package';
  }

  // --- All Shorts ---
  loadShorts(): void {
    this.loading.set(true);
    const params: Record<string, any> = {
      page: this.page(),
      limit: this.limit,
    };
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.searchQuery.trim()) params['search'] = this.searchQuery.trim();
    if (this.filterCategory) params['categoryId'] = this.filterCategory;
    if (this.filterDateFrom) params['dateFrom'] = this.filterDateFrom;
    if (this.filterDateTo) params['dateTo'] = this.filterDateTo;
    if (this.sortBy === 'oldest') {
      params['sort'] = 'createdAt';
      params['order'] = 'asc';
    } else if (this.sortBy === 'views') {
      params['sort'] = 'viewCount';
      params['order'] = 'desc';
    }

    this.shortsService.adminListShorts(params).subscribe({
      next: (res) => {
        this.shorts.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(Math.ceil(res.total / this.limit));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadShorts();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.searchQuery = '';
    this.filterCategory = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.sortBy = 'newest';
    this.page.set(1);
    this.loadShorts();
  }

  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return;
    this.page.set(newPage);
    this.loadShorts();
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

  // --- Moderation ---
  loadPendingShorts(): void {
    this.modLoading.set(true);
    this.shortsService.adminListShorts({ status: 'pending_review', limit: 100 }).subscribe({
      next: (res) => {
        this.pendingShorts.set(res.data);
        this.pendingCount.set(res.total);
        this.modLoading.set(false);
      },
      error: () => this.modLoading.set(false),
    });
  }

  async approveShort(id: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Approve Short',
      message: 'Approve this short? It will go live and become visible to everyone.',
      confirmText: 'Approve',
      variant: 'info',
    });
    if (!confirmed) return;

    this.modActionLoading.set(id);
    this.shortsService.adminApproveShort(id).subscribe({
      next: () => {
        this.pendingShorts.update((list) => list.filter((s) => s._id !== id));
        this.pendingCount.update((c) => c - 1);
        this.modActionLoading.set(null);
        this.toast.success('Short approved.');
      },
      error: () => {
        this.modActionLoading.set(null);
        this.toast.error('Failed to approve short.');
      },
    });
  }

  openRejectModal(short: ShortVideo): void {
    this.rejectingShort.set(short);
    this.rejectionReason = '';
  }

  confirmReject(): void {
    const short = this.rejectingShort();
    if (!short || !this.rejectionReason.trim()) return;

    this.modActionLoading.set(short._id);
    this.shortsService.adminRejectShort(short._id, this.rejectionReason).subscribe({
      next: () => {
        this.pendingShorts.update((list) => list.filter((s) => s._id !== short._id));
        this.pendingCount.update((c) => c - 1);
        this.rejectingShort.set(null);
        this.modActionLoading.set(null);
        this.toast.success('Short rejected.');
      },
      error: () => {
        this.modActionLoading.set(null);
        this.toast.error('Failed to reject short.');
      },
    });
  }

  async deleteShort(id: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Delete Short',
      message: 'Are you sure you want to delete this short? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.shortsService.adminDeleteShort(id).subscribe({
      next: () => {
        this.shorts.update((list) => list.filter((s) => s._id !== id));
        this.pendingShorts.update((list) => list.filter((s) => s._id !== id));
        this.toast.success('Short deleted.');
      },
      error: () => this.toast.error('Failed to delete short.'),
    });
  }

  openPreview(short: ShortVideo): void {
    this.previewShort.set(short);
  }

  sortModerationShorts(col: string): void {
    if (this.modSortCol === col) {
      this.modSortDir = this.modSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.modSortCol = col;
      this.modSortDir = 'asc';
    }
    const dir = this.modSortDir === 'asc' ? 1 : -1;
    this.pendingShorts.update((list) =>
      [...list].sort((a: any, b: any) => {
        const va = a[col];
        const vb = b[col];
        if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
        return ((va ?? 0) - (vb ?? 0)) * dir;
      }),
    );
  }

  modSortIcon(col: string): string {
    if (col !== this.modSortCol) return 'unfold_more';
    return this.modSortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  getSellerName(short: ShortVideo): string {
    const s = short.sellerId as any;
    if (s?.profile) return `${s.profile.firstName || ''} ${s.profile.lastName || ''}`.trim();
    return 'Unknown';
  }

  getSellerContact(short: ShortVideo): string {
    const s = short.sellerId as any;
    return s?.email || s?.phone || '';
  }
}
