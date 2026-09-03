import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import { ToastService } from '../../../core/services/toast.service';
import { ReviewStatus } from '../../../core/models/review.model';

/** Value object mirroring the ReviewStatus string-union for template use. */
const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const satisfies Record<string, ReviewStatus>;
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';

const FALLBACK_USER = 'Unknown User';
const FALLBACK_VALUE = '—';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

interface AdminReviewUser {
  _id?: string;
  email?: string;
  profile?: { firstName?: string; lastName?: string; avatar?: string };
}

interface AdminReview {
  _id: string;
  rating: number;
  text: string;
  images: { url: string; key: string }[];
  status: ReviewStatus;
  moderationNote?: string;
  moderatedAt?: string;
  createdAt: string;
  reviewer?: AdminReviewUser;
  seller?: AdminReviewUser & { averageRating?: number; reviewCount?: number };
  listing?: { _id: string; title?: string };
}

function displayName(u?: AdminReviewUser): string {
  if (!u) return FALLBACK_USER;
  const full = `${u.profile?.firstName ?? ''} ${u.profile?.lastName ?? ''}`.trim();
  return full || u.email || FALLBACK_USER;
}

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomSelectComponent,
    AppLoaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    ModalComponent,
    StarRatingComponent,
  ],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss',
})
export class ReviewsComponent implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly destroy$ = new Subject<void>();

  readonly ReviewStatus = REVIEW_STATUS;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly reviews = signal<AdminReview[]>([]);
  readonly total = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly actionLoading = signal<string | null>(null);

  statusFilter = REVIEW_STATUS.PENDING as string;
  searchQuery = '';

  readonly selected = signal<AdminReview | null>(null);
  rejecting = false;
  moderationNote = '';
  lightboxUrl: string | null = null;

  // Rejected reviews are deleted, so only pending/approved persist.
  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: REVIEW_STATUS.PENDING, label: 'Pending' },
    { value: REVIEW_STATUS.APPROVED, label: 'Approved' },
  ];

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reviewerName(r: AdminReview): string {
    return displayName(r.reviewer);
  }
  sellerName(r: AdminReview): string {
    return displayName(r.seller);
  }
  listingTitle(r: AdminReview): string {
    return r.listing?.title || FALLBACK_VALUE;
  }
  formatDate(value?: string): string {
    return value
      ? new Date(value).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS)
      : FALLBACK_VALUE;
  }

  loadReviews(): void {
    this.loading.set(true);
    this.error.set('');

    let params = new HttpParams()
      .set('page', this.currentPage().toString())
      .set('limit', this.pageSize().toString());
    if (this.statusFilter) params = params.set('status', this.statusFilter);
    if (this.searchQuery.trim()) params = params.set('search', this.searchQuery.trim());

    this.http
      .get<any>(`${this.apiUrl}${API.ADMIN_REVIEWS}`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const payload = res && res.statusCode ? res.data : res;
          const items = Array.isArray(payload) ? payload : (payload?.data ?? []);
          const total = Array.isArray(payload) ? payload.length : (payload?.total ?? 0);
          this.reviews.set(items);
          this.total.set(total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load reviews.');
          this.loading.set(false);
        },
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadReviews();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadReviews();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadReviews();
  }

  openDetail(r: AdminReview): void {
    this.selected.set(r);
    this.rejecting = false;
    this.moderationNote = '';
  }

  closeDetail(): void {
    this.selected.set(null);
    this.rejecting = false;
    this.moderationNote = '';
  }

  startReject(): void {
    this.rejecting = true;
  }

  cancelReject(): void {
    this.rejecting = false;
    this.moderationNote = '';
  }

  approve(): void {
    const r = this.selected();
    if (!r) return;
    this.moderate(r, REVIEW_STATUS.APPROVED, this.moderationNote.trim() || undefined);
  }

  confirmReject(): void {
    const r = this.selected();
    if (!r) return;
    this.moderate(r, REVIEW_STATUS.REJECTED, this.moderationNote.trim() || undefined);
  }

  private moderate(r: AdminReview, status: ReviewStatus, moderationNote?: string): void {
    this.actionLoading.set(r._id);
    this.http
      .patch<any>(`${this.apiUrl}${API.ADMIN_REVIEW_MODERATE(r._id)}`, {
        status,
        ...(moderationNote ? { moderationNote } : {}),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.toast.success(
            status === REVIEW_STATUS.APPROVED
              ? 'Review approved and published.'
              : 'Review rejected and removed.',
          );
          this.closeDetail();
          this.loadReviews();
        },
        error: () => {
          this.actionLoading.set(null);
          this.toast.error('Failed to moderate review. Please try again.');
        },
      });
  }

  openLightbox(url: string): void {
    this.lightboxUrl = url;
  }

  closeLightbox(): void {
    this.lightboxUrl = null;
  }
}
