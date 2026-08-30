import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShortsService } from '../../../core/services/shorts.service';

@Component({
  selector: 'app-shorts-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent],
  templateUrl: './shorts-analytics.component.html',
  styleUrl: './shorts-analytics.component.scss',
})
export class ShortsAnalyticsComponent implements OnInit {
  readonly analytics = signal<any>(null);
  readonly loading = signal(true);

  dateFrom = '';
  dateTo = '';
  sortTopBy = signal<'views' | 'likes'>('views');

  constructor(private readonly shortsService: ShortsService) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading.set(true);
    const params: Record<string, any> = {};
    if (this.dateFrom) params['dateFrom'] = this.dateFrom;
    if (this.dateTo) params['dateTo'] = this.dateTo;

    this.shortsService.adminGetAnalytics(params).subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyDateFilter(): void {
    this.loadAnalytics();
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.loadAnalytics();
  }

  getSellerName(short: any): string {
    const s = short.sellerId;
    if (s?.profile) return `${s.profile.firstName || ''} ${s.profile.lastName || ''}`.trim();
    return 'Unknown';
  }

  /** Uploads per day, as an area series. */
  readonly uploadsChart = computed(() => {
    const days = this.analytics()?.uploadsByDay ?? [];
    return {
      // `_id` is the grouped date key from the aggregation.
      labels: days.map((day: { _id: string }) => day._id.slice(5)),
      series: [
        {
          label: 'Uploads',
          data: days.map((day: { count: number }) => day.count),
          color: 'primary' as const,
        },
      ],
    };
  });

  getMaxUploads(): number {
    const days = this.analytics()?.uploadsByDay ?? [];
    return Math.max(1, ...days.map((d: any) => d.count));
  }
}
