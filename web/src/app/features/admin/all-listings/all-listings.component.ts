import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { saveState, loadState } from '../../../core/utils/state-persistence';
import { ListingStatus } from '../../../core/constants/enums';
import { PAGE_SIZE_DEFAULT } from '../../../core/constants/app';
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

  constructor(
    private readonly adminService: AdminService,
    private readonly categoriesService: CategoriesService,
    private readonly locationService: LocationService,
  ) {}

  private readonly stateKey = 'admin-all-listings';

  ngOnInit(): void {
    const saved = loadState<{ filterStatus: string; sortBy: string; page: number }>(this.stateKey);
    if (saved.filterStatus) this.filterStatus = saved.filterStatus;
    if (saved.sortBy) this.sortBy = saved.sortBy;
    if (saved.page) this.page = saved.page;

    this.loadListings();
    this.loadCategories();
    this.loadProvinces();
    this.loadRejectionReasons();
    this.loadDeletionReasons();
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.categoryOptions = [
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
  formatPrice(l: AdminListing): string {
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
}
