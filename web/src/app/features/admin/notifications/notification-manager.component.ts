import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';
import {
  AdminNotification,
  AdminNotificationListResponse,
} from '../../../core/models/notification.model';
import {
  CHANNEL_OPTIONS,
  AUDIENCE_OPTIONS,
  CATEGORY_OPTIONS,
  ROLE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  CHANNEL_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_COLORS,
  DEFAULT_STATUS_COLOR,
} from '../../../core/constants/notification-options';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-notification-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './notification-manager.component.html',
  styleUrl: './notification-manager.component.scss',
})
export class NotificationManagerComponent implements OnInit {
  readonly CHANNEL_OPTIONS = CHANNEL_OPTIONS;
  readonly AUDIENCE_OPTIONS = AUDIENCE_OPTIONS;
  readonly CATEGORY_OPTIONS = CATEGORY_OPTIONS;
  readonly ROLE_OPTIONS = ROLE_OPTIONS;
  readonly STATUS_FILTER_OPTIONS = STATUS_FILTER_OPTIONS;
  readonly CHANNEL_FILTER_OPTIONS = CHANNEL_FILTER_OPTIONS;
  readonly SORT_OPTIONS = SORT_OPTIONS;

  notifications = signal<AdminNotification[]>([]);
  total = signal(0);
  page = 1;
  loading = signal(false);
  sending = signal(false);
  showForm = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  expandedId = signal<string | null>(null);
  filtersOpen = false;

  searchQuery = '';
  filterStatus = '';
  filterChannel = '';
  sortBy = '-createdAt';

  sendForm: FormGroup;
  totalPages = computed(() => Math.ceil(this.total() / PAGE_SIZE));

  /** Precomputed status color map — avoids method calls in template */
  statusColorMap = computed(() => {
    const map = new Map<string, string>();
    for (const n of this.notifications()) {
      if (!map.has(n.status)) {
        map.set(n.status, STATUS_COLORS[n.status] || DEFAULT_STATUS_COLOR);
      }
    }
    return map;
  });

  /** Precomputed read rate map — avoids method calls in template */
  readRateMap = computed(() => {
    const map = new Map<string, string>();
    for (const n of this.notifications()) {
      if (!n.recipientCount) {
        map.set(n._id, '—');
      } else {
        map.set(n._id, Math.round((n.readCount / n.recipientCount) * 100) + '%');
      }
    }
    return map;
  });

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.filterStatus || this.filterChannel);
  }

  get activeFilterCount(): number {
    return [this.searchQuery, this.filterStatus, this.filterChannel].filter(Boolean).length;
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
  ) {
    this.sendForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      body: ['', [Validators.required, Validators.maxLength(5000)]],
      channel: ['push', Validators.required],
      audience: ['all', Validators.required],
      targetRole: ['user'],
      targetUserIds: [''],
      category: ['promotions'],
    });
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  applyFilters(): void {
    this.page = 1;
    this.loadNotifications();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterChannel = '';
    this.sortBy = '-createdAt';
    this.applyFilters();
  }

  loadNotifications(): void {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.page.toString())
      .set('limit', PAGE_SIZE.toString());

    if (this.filterStatus) params = params.set('status', this.filterStatus);

    this.http
      .get<AdminNotificationListResponse>(`${this.apiUrl}${API.ADMIN_NOTIFICATIONS}`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          let filtered = res.data;

          if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(
              (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
            );
          }

          if (this.filterChannel) {
            filtered = filtered.filter((n) => n.channel === this.filterChannel);
          }

          const sortKey = this.sortBy.replace('-', '') as keyof AdminNotification;
          const sortDir = this.sortBy.startsWith('-') ? -1 : 1;
          filtered.sort((a, b) => {
            const aVal = a[sortKey] ?? '';
            const bVal = b[sortKey] ?? '';
            if (aVal < bVal) return -1 * sortDir;
            if (aVal > bVal) return 1 * sortDir;
            return 0;
          });

          this.notifications.set(filtered);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('Failed to load notifications.');
          this.loading.set(false);
        },
      });
  }

  onSend(): void {
    if (this.sendForm.invalid) {
      this.sendForm.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.sendForm.value;
    const payload: Record<string, any> = {
      title: formValue.title,
      body: formValue.body,
      channel: formValue.channel,
      audience: formValue.audience,
      category: formValue.category,
    };

    if (formValue.audience === 'role') {
      payload['targetRole'] = formValue.targetRole;
    }
    if (formValue.audience === 'specific' && formValue.targetUserIds) {
      payload['targetUserIds'] = formValue.targetUserIds
        .split(',')
        .map((id: string) => id.trim())
        .filter(Boolean);
    }

    this.http
      .post(`${this.apiUrl}${API.ADMIN_NOTIFICATIONS_SEND}`, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.successMessage.set('Notification is being sent to recipients.');
          this.sendForm.reset({
            channel: 'push',
            audience: 'all',
            targetRole: 'user',
            category: 'promotions',
          });
          this.showForm.set(false);
          this.loadNotifications();
        },
        error: (err) => {
          this.sending.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to send notification.');
        },
      });
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadNotifications();
  }

  toggleExpand(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    this.successMessage.set('');
    this.errorMessage.set('');
  }
}
