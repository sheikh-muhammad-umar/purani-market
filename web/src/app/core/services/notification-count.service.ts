import { Injectable, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { API } from '../constants/api-endpoints';

const POLL_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationCountService {
  readonly unreadCount = signal(0);

  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  /** Start polling — safe to call multiple times */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => this.stop());
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.started = false;
  }

  refresh(): void {
    const params = new HttpParams().set('page', '1').set('limit', '1');
    this.http
      .get<{ unreadCount: number }>(`${environment.apiUrl}${API.NOTIFICATIONS}`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.unreadCount.set(res.unreadCount),
        error: () => {},
      });
  }

  /** Called by the bell component when user marks notifications as read */
  setCount(count: number): void {
    this.unreadCount.set(count);
  }
}
