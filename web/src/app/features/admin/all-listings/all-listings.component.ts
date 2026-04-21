import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { LocationService } from '../../../core/services/location.service';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';
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
    return !!(this.filterStatus || this.filterCategory || this.filterProvince || this.filterCity || this.filterRejectionReason || this.filterDeletionReason || this.filterDateFrom || this.filterDateTo || this.searchQuery);
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

  ngOnInit(): void {
    this.loadListings();
    this.loadCategories();
    this.loadProvinces();
    this.loadRejectionReasons();
    this.loadDeletionReasons();
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (cats) => {
        this.categoryOptions = [{ value: '', label: 'All Categories' }, ...cats.map(c => ({ value: c._id, label: c.name }))];
      },
    });
  }

  loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (provinces: any[]) => {
        this.provinceOptions = [{ value: '', label: 'All Provinces' }, ...provinces.map((p: any) => ({ value: p._id, label: p.name }))];
      },
    });
  }

  onProvinceChange(): void {
    this.filterCity = '';
    this.cityOptions = [{ value: '', label: 'All Cities' }];
    if (this.filterProvince) {
      this.locationService.getCities(this.filterProvince).subscribe({
        next: (cities: any[]) => {
          this.cityOptions = [{ value: '', label: 'All Cities' }, ...cities.map((c: any) => ({ value: c._id, label: c.name }))];
        },
      });
    }
    this.applyFilters();
  }

  loadRejectionReasons(): void {
    this.adminService.getRejectionReasons(true).subscribe({
      next: (reasons) => {
        this.rejectionReasonOptions = [{ value: '', label: 'All' }, ...reasons.map((r: any) => ({ value: r.title, label: r.title }))];
      },
    });
  }

  loadDeletionReasons(): void {
    this.adminService.getDeletionReasons(true).subscribe({
      next: (reasons) => {
        this.deletionReasonOptions = [{ value: '', label: 'All' }, ...reasons.map((r: any) => ({ value: r.title, label: r.title }))];
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

    this.adminService.getAllListings({
      page: this.page, limit: 20,
      search: this.searchQuery.trim() || undefined,
      status: this.filterStatus || undefined,
      categoryId: this.filterCategory || undefined,
      provinceId: this.filterProvince || undefined,
      cityId: this.filterCity || undefined,
      rejectionReason: this.filterRejectionReason || undefined,
      deletionReason: this.filterDeletionReason || undefined,
      dateFrom: this.filterDateFrom || undefined,
      dateTo: this.filterDateTo || undefined,
      sort, order,
    }).subscribe({
      next: (res: any) => {
        this.listings.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.totalPages.set(res.totalPages ?? 0);
        this.loading.set(false);
      },
      error: () => { this.listings.set([]); this.loading.set(false); },
    });
  }

  applyFilters(): void { this.page = 1; this.loadListings(); }
  clearFilters(): void {
    this.searchQuery = ''; this.filterStatus = ''; this.filterCategory = '';
    this.filterProvince = ''; this.filterCity = '';
    this.filterRejectionReason = ''; this.filterDeletionReason = '';
    this.filterDateFrom = ''; this.filterDateTo = ''; this.sortBy = 'newest';
    this.cityOptions = [{ value: '', label: 'All Cities' }];
    this.page = 1; this.loadListings();
  }
  goToPage(p: number): void { if (p < 1 || p > this.totalPages()) return; this.page = p; this.loadListings(); }

  formatDate(d: string): string { return d ? new Date(d).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
  formatPrice(l: AdminListing): string { return l.price ? `${l.price.currency} ${l.price.amount.toLocaleString()}` : '—'; }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      active: '#00B894', pending_review: '#F39C12', rejected: '#E74C3C',
      sold: '#6C5CE7', inactive: '#636e72', deleted: '#E74C3C',
    };
    return map[status] || '#636e72';
  }
}
