import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  PendingListing,
} from '../../../core/services/admin.service';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.scss'],
})
export class ModerationQueueComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly listings = signal<PendingListing[]>([]);
  readonly totalListings = signal(0);
  readonly actionLoading = signal<string | null>(null);

  rejectionReasons: Record<string, string> = {};
  rejectingId: string | null = null;
  expandedId: string | null = null;

  // Sorting
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  searchQuery = '';

  constructor(private readonly adminService: AdminService) {}

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  ngOnInit(): void {
    this.loadPendingListings();
  }

  loadPendingListings(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService.getPendingListings().subscribe({
      next: (res: any) => {
        const data = (res && res.data && res.statusCode) ? res.data : res;
        const listings = data.listings ?? data.data ?? [];
        const sorted = [...listings].sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        this.listings.set(sorted);
        this.totalListings.set(data.total ?? sorted.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load pending listings. Please try again.');
        this.loading.set(false);
      },
    });
  }

  approveListing(listing: PendingListing): void {
    this.actionLoading.set(listing._id);
    this.adminService.approveListing(listing._id).subscribe({
      next: () => {
        this.listings.update((list) => list.filter((l) => l._id !== listing._id));
        this.totalListings.update((t) => t - 1);
        this.actionLoading.set(null);
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }

  startReject(listing: PendingListing): void {
    this.rejectingId = listing._id;
  }

  cancelReject(): void {
    this.rejectingId = null;
  }

  confirmReject(listing: PendingListing): void {
    const reason = (this.rejectionReasons[listing._id] || '').trim();
    if (!reason) return;
    this.actionLoading.set(listing._id);
    this.adminService.rejectListing(listing._id, reason).subscribe({
      next: () => {
        this.listings.update((list) => list.filter((l) => l._id !== listing._id));
        this.totalListings.update((t) => t - 1);
        this.rejectingId = null;
        delete this.rejectionReasons[listing._id];
        this.actionLoading.set(null);
      },
      error: () => {
        this.actionLoading.set(null);
      },
    });
  }

  getThumbnail(listing: PendingListing): string {
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailUrl || listing.images[0].url;
    }
    return '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  }

  formatPrice(listing: PendingListing): string {
    if (!listing.price) return '—';
    return `${listing.price.currency} ${listing.price.amount.toLocaleString()}`;
  }

  objectKeys(obj: any): string[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).filter(k => obj[k] !== '' && obj[k] !== null && obj[k] !== undefined);
  }

  formatAttrKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  sortListings(col: string): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'asc';
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    this.listings.update(list => [...list].sort((a: any, b: any) => {
      let va = col === 'price' ? a.price?.amount : a[col];
      let vb = col === 'price' ? b.price?.amount : b[col];
      if (typeof va === 'string') return (va || '').localeCompare(vb || '') * dir;
      return ((va ?? 0) - (vb ?? 0)) * dir;
    }));
  }

  sortIcon(col: string): string {
    if (col !== this.sortCol) return 'unfold_more';
    return this.sortDir === 'asc' ? 'expand_less' : 'expand_more';
  }

  get filteredListings(): PendingListing[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.listings();
    return this.listings().filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.sellerEmail?.toLowerCase().includes(q) ||
      l.sellerName?.toLowerCase().includes(q)
    );
  }
}
