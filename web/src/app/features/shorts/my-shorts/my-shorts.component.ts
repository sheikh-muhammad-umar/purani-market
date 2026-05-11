import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShortsService, ShortVideo, ShortsStats } from '../../../core/services/shorts.service';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { FormatStatusPipe } from '../../../shared/pipes/format-status.pipe';
import { ROUTES } from '../../../core/constants/routes';
import { daysToMs } from '../../../core/utils/time';

@Component({
  selector: 'app-my-shorts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormatDurationPipe, FormatStatusPipe],
  templateUrl: './my-shorts.component.html',
  styleUrl: './my-shorts.component.scss',
})
export class MyShortsComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly shorts = signal<ShortVideo[]>([]);
  readonly stats = signal<ShortsStats | null>(null);
  readonly loading = signal(true);

  constructor(
    private readonly shortsService: ShortsService,
    private readonly confirmModal: ConfirmModalService,
    private readonly tracker: ActivityTrackerService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.shortsService.getMyStats().subscribe({
      next: (stats) => this.stats.set(stats),
    });

    this.shortsService.getMyShorts(1, 50).subscribe({
      next: (res) => {
        this.shorts.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  async deleteShort(id: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Delete Short',
      message:
        "Are you sure you want to delete this short? This action cannot be undone and won't restore your monthly upload limit.",
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (confirmed) {
      this.shortsService.deleteShort(id).subscribe({
        next: () => {
          this.tracker.track(TrackingEvent.SHORT_DELETE, { metadata: { shortId: id } });
          this.shorts.update((list) => list.filter((s) => s._id !== id));
          this.loadData();
        },
      });
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  isExpiringSoon(expiresAt: string): boolean {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < daysToMs(2); // 2 days
  }
}
