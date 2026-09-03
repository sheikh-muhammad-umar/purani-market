import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import { ToastService } from '../../../core/services/toast.service';
import { AdminReport, ReportStatus } from '../../../core/models/report.model';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

const FALLBACK_USER = 'Unknown User';
const FALLBACK_VALUE = '—';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function displayName(u?: {
  profile?: { firstName?: string; lastName?: string };
  email?: string;
}): string {
  if (!u) return FALLBACK_USER;
  const p = u.profile;
  const full = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
  return full || u.email || FALLBACK_USER;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomSelectComponent,
    AppLoaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    ModalComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private readonly destroy$ = new Subject<void>();

  readonly ReportStatus = ReportStatus;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly reports = signal<AdminReport[]>([]);
  readonly total = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly actionLoading = signal<string | null>(null);

  statusFilter = ReportStatus.PENDING as string;
  searchQuery = '';

  // Detail / review modal state
  readonly selected = signal<AdminReport | null>(null);
  rejecting = false;
  reviewNote = '';
  lightboxUrl: string | null = null;

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: ReportStatus.PENDING, label: 'Pending' },
    { value: ReportStatus.APPROVED, label: 'Approved' },
    { value: ReportStatus.REJECTED, label: 'Rejected' },
  ];

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadReports();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Display helpers ─────────────────────────────────────────
  reporterName(r: AdminReport): string {
    return displayName(r.reporter);
  }
  reportedName(r: AdminReport): string {
    return displayName(r.reportedUser);
  }
  reportedContact(r: AdminReport): string {
    return r.reportedUser?.email || FALLBACK_VALUE;
  }
  formatDate(value?: string): string {
    return value
      ? new Date(value).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS)
      : FALLBACK_VALUE;
  }

  // ── Data ────────────────────────────────────────────────────
  loadReports(): void {
    this.loading.set(true);
    this.error.set('');

    let params = new HttpParams()
      .set('page', this.currentPage().toString())
      .set('limit', this.pageSize().toString());
    if (this.statusFilter) params = params.set('status', this.statusFilter);
    if (this.searchQuery.trim()) params = params.set('search', this.searchQuery.trim());

    this.http
      .get<any>(`${this.apiUrl}${API.ADMIN_REPORTS}`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const payload = res && res.statusCode ? res.data : res;
          const items = Array.isArray(payload) ? payload : (payload?.data ?? []);
          const total = Array.isArray(payload) ? payload.length : (payload?.total ?? 0);
          this.reports.set(items);
          this.total.set(total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load reports.');
          this.loading.set(false);
        },
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadReports();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadReports();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadReports();
  }

  // ── Review modal ────────────────────────────────────────────
  openDetail(r: AdminReport): void {
    this.selected.set(r);
    this.rejecting = false;
    this.reviewNote = '';
  }

  closeDetail(): void {
    this.selected.set(null);
    this.rejecting = false;
    this.reviewNote = '';
  }

  startReject(): void {
    this.rejecting = true;
  }

  cancelReject(): void {
    this.rejecting = false;
    this.reviewNote = '';
  }

  approve(): void {
    const r = this.selected();
    if (!r) return;
    this.review(r, ReportStatus.APPROVED, this.reviewNote.trim() || undefined);
  }

  confirmReject(): void {
    const r = this.selected();
    if (!r) return;
    this.review(r, ReportStatus.REJECTED, this.reviewNote.trim() || undefined);
  }

  private review(r: AdminReport, status: ReportStatus, reviewNote?: string): void {
    this.actionLoading.set(r._id);
    this.http
      .patch<any>(`${this.apiUrl}${API.ADMIN_REPORT_REVIEW(r._id)}`, {
        status,
        ...(reviewNote ? { reviewNote } : {}),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.actionLoading.set(null);
          const payload = res && res.statusCode ? res.data : res;
          if (status === ReportStatus.APPROVED) {
            this.toast.success(
              payload?.suspended
                ? 'Report approved. The account has been suspended.'
                : 'Report approved.',
            );
          } else {
            this.toast.success('Report rejected.');
          }
          this.closeDetail();
          this.loadReports();
        },
        error: () => {
          this.actionLoading.set(null);
          this.toast.error('Failed to review report. Please try again.');
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
