import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../environments/environment';
import { API } from '../../../core/constants/api-endpoints';
import {
  CustomSelectComponent,
  SelectOption,
} from '../../../shared/components/custom-select/custom-select.component';
import {
  Experiment,
  ExperimentMetrics,
  VariantMetrics,
  StatusFilter,
  SortField,
} from './experiments.types';

@Component({
  selector: 'app-experiments-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CustomSelectComponent],
  templateUrl: './experiments-dashboard.component.html',
  styleUrl: './experiments-dashboard.component.scss',
})
export class ExperimentsDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = environment.apiUrl;

  readonly SKELETON_ITEMS = [1, 2, 3];

  readonly experiments = signal<Experiment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal<string | null>(null);

  // Filters & Sort
  statusFilter: StatusFilter = '';
  searchQuery = '';
  sortField: SortField = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';

  // Create form
  readonly showCreateForm = signal(false);
  readonly creating = signal(false);
  createForm: FormGroup;

  // Metrics view
  readonly selectedMetrics = signal<ExperimentMetrics | null>(null);
  readonly metricsLoading = signal(false);
  readonly winningVariant = computed(() => {
    const metrics = this.selectedMetrics();
    if (!metrics || metrics.variants.length === 0) return null;
    const withData = metrics.variants.filter((v) => v.impressions > 0);
    if (withData.length === 0) return null;
    return withData.reduce((best, v) => (v.ctr > best.ctr ? v : best));
  });

  readonly filteredExperiments = computed(() => {
    let list = this.experiments();

    if (this.statusFilter) {
      list = list.filter((e) => e.status === this.statusFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.key.toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q),
      );
    }

    const dir = this.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const va = (a as any)[this.sortField] || '';
      const vb = (b as any)[this.sortField] || '';
      return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
    });

    return list;
  });

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'running', label: 'Running' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ];

  constructor(
    private readonly http: HttpClient,
    private readonly fb: FormBuilder,
  ) {
    this.createForm = this.fb.group({
      key: [
        '',
        [Validators.required, Validators.pattern(/^[a-z0-9_]+$/), Validators.maxLength(50)],
      ],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      variants: this.fb.array([]),
    });
    this.addVariant();
    this.addVariant();
  }

  get variantsArray(): FormArray {
    return this.createForm.get('variants') as FormArray;
  }

  ngOnInit(): void {
    this.loadExperiments();
  }

  loadExperiments(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<Experiment[]>(`${this.apiUrl}${API.EXPERIMENTS}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.experiments.set(Array.isArray(data) ? data : []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load experiments.');
          this.loading.set(false);
        },
      });
  }

  // ── Filters ───────────────────────────────────────────────────

  applyFilter(): void {
    // Triggers computed recalculation via signal reads in filteredExperiments
    this.experiments.update((e) => [...e]);
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'desc';
    }
    this.applyFilter();
  }

  // ── Create ────────────────────────────────────────────────────

  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
  }

  addVariant(): void {
    this.variantsArray.push(
      this.fb.group({
        id: ['', Validators.required],
        name: ['', Validators.required],
        weight: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
      }),
    );
  }

  removeVariant(index: number): void {
    if (this.variantsArray.length > 2) {
      this.variantsArray.removeAt(index);
    }
  }

  onCreateSubmit(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    const value = this.createForm.value;
    this.http
      .post(`${this.apiUrl}${API.EXPERIMENTS}`, {
        key: value.key,
        name: value.name,
        description: value.description,
        variants: value.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          weight: v.weight,
          config: {},
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showCreateForm.set(false);
          this.createForm.reset();
          this.variantsArray.clear();
          this.addVariant();
          this.addVariant();
          this.loadExperiments();
        },
        error: (err) => {
          this.creating.set(false);
          this.error.set(err.error?.message || 'Failed to create experiment.');
        },
      });
  }

  // ── Actions ───────────────────────────────────────────────────

  startExperiment(key: string): void {
    this.actionLoading.set(key);
    this.http
      .patch(`${this.apiUrl}${API.EXPERIMENT_START(key)}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.loadExperiments();
        },
        error: () => this.actionLoading.set(null),
      });
  }

  pauseExperiment(key: string): void {
    this.actionLoading.set(key);
    this.http
      .patch(`${this.apiUrl}${API.EXPERIMENT_PAUSE(key)}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.loadExperiments();
        },
        error: () => this.actionLoading.set(null),
      });
  }

  completeExperiment(key: string): void {
    this.actionLoading.set(key);
    this.http
      .patch(`${this.apiUrl}${API.EXPERIMENT_COMPLETE(key)}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionLoading.set(null);
          this.selectedMetrics.set(null);
          this.loadExperiments();
        },
        error: () => this.actionLoading.set(null),
      });
  }

  // ── Metrics ───────────────────────────────────────────────────

  viewMetrics(key: string): void {
    this.metricsLoading.set(true);
    this.http
      .get<ExperimentMetrics>(`${this.apiUrl}${API.EXPERIMENT_METRICS(key)}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metrics) => {
          this.selectedMetrics.set(metrics);
          this.metricsLoading.set(false);
        },
        error: () => {
          this.metricsLoading.set(false);
          this.error.set('Failed to load metrics.');
        },
      });
  }

  closeMetrics(): void {
    this.selectedMetrics.set(null);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return 'var(--success)';
      case 'paused':
        return 'var(--warning, #f39c12)';
      case 'completed':
        return 'var(--primary)';
      default:
        return 'var(--text-muted)';
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
