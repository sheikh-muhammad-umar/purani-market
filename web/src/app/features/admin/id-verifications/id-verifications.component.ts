import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import {
  IdVerificationRequest,
  IdVerificationStatus,
} from '../../../core/models/id-verification.model';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';

const FALLBACK_USER = 'Unknown User';
const FALLBACK_VALUE = '—';
const PAGE_WINDOW = 2;

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

@Component({
  selector: 'app-id-verifications',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  templateUrl: './id-verifications.component.html',
  styleUrl: './id-verifications.component.scss',
})
export class IdVerificationsComponent implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly error = signal('');
  readonly verifications = signal<IdVerificationRequest[]>([]);
  readonly total = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly actionLoading = signal<string | null>(null);

  readonly IdVerificationStatus = IdVerificationStatus;

  statusFilter = '';
  searchQuery = '';

  expandedId: string | null = null;
  rejectingId: string | null = null;
  rejectionReason = '';
  lightboxUrl: string | null = null;
  approvingVerification: IdVerificationRequest | null = null;

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: IdVerificationStatus.PENDING, label: 'Pending' },
    { value: IdVerificationStatus.APPROVED, label: 'Approved' },
    { value: IdVerificationStatus.REJECTED, label: 'Rejected' },
  ];

  /** Precomputed maps to avoid template method calls on every CD cycle */
  readonly userNames = computed(() => {
    const map = new Map<string, string>();
    for (const v of this.verifications()) {
      const p = v.user?.profile;
      const name =
        p?.firstName || p?.lastName
          ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
          : v.user?.email || v.user?.phone || FALLBACK_USER;
      map.set(v._id, name);
    }
    return map;
  });

  readonly userContacts = computed(() => {
    const map = new Map<string, string>();
    for (const v of this.verifications()) {
      map.set(v._id, v.user?.email || v.user?.phone || FALLBACK_VALUE);
    }
    return map;
  });

  readonly formattedDates = computed(() => {
    const map = new Map<string, string>();
    for (const v of this.verifications()) {
      map.set(
        v._id,
        v.createdAt
          ? new Date(v.createdAt).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS)
          : FALLBACK_VALUE,
      );
    }
    return map;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - PAGE_WINDOW);
    const end = Math.min(total, current + PAGE_WINDOW);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadVerifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadVerifications(): void {
    this.loading.set(true);
    this.error.set('');

    let params = new HttpParams()
      .set('page', this.currentPage().toString())
      .set('limit', this.pageSize().toString());

    if (this.statusFilter) params = params.set('status', this.statusFilter);
    if (this.searchQuery.trim()) params = params.set('search', this.searchQuery.trim());

    this.http
      .get<any>(`${this.apiUrl}${API.ID_VERIFICATION_ADMIN_ALL}`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const payload = res && res.statusCode ? res.data : res;
          const items = Array.isArray(payload) ? payload : (payload?.data ?? []);
          const total = Array.isArray(payload) ? payload.length : (payload?.total ?? 0);
          this.verifications.set(items);
          this.total.set(total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(ERROR_MSG.VERIFICATIONS_LOAD_FAILED);
          this.loading.set(false);
        },
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadVerifications();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadVerifications();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadVerifications();
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
    this.rejectingId = null;
    this.rejectionReason = '';
  }

  approve(v: IdVerificationRequest): void {
    this.approvingVerification = v;
  }

  cancelApprove(): void {
    this.approvingVerification = null;
  }

  confirmApprove(): void {
    const v = this.approvingVerification;
    if (!v) return;

    this.actionLoading.set(v._id);
    this.approvingVerification = null;
    this.http
      .patch(`${this.apiUrl}${API.ID_VERIFICATION_ADMIN_REVIEW(v._id)}`, {
        status: IdVerificationStatus.APPROVED,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.loadVerifications();
        },
        error: (err) => {
          this.actionLoading.set(null);
          this.error.set(err.error?.message || ERROR_MSG.VERIFICATION_APPROVE_FAILED);
        },
      });
  }

  startReject(v: IdVerificationRequest): void {
    this.rejectingId = v._id;
    this.expandedId = v._id;
    this.rejectionReason = '';
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectionReason = '';
  }

  confirmReject(v: IdVerificationRequest): void {
    if (!this.rejectionReason.trim()) return;

    this.actionLoading.set(v._id);
    this.http
      .patch(`${this.apiUrl}${API.ID_VERIFICATION_ADMIN_REVIEW(v._id)}`, {
        status: IdVerificationStatus.REJECTED,
        rejectionReason: this.rejectionReason.trim(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.rejectingId = null;
          this.rejectionReason = '';
          this.loadVerifications();
        },
        error: (err) => {
          this.actionLoading.set(null);
          this.error.set(err.error?.message || ERROR_MSG.VERIFICATION_REJECT_FAILED);
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
