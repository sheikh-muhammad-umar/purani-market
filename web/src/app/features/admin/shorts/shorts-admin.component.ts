import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShortsService, ShortVideo, ShortsPackage } from '../../../core/services/shorts.service';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { FormatStatusPipe } from '../../../shared/pipes/format-status.pipe';
import { DEFAULT_CURRENCY } from '../../../core/constants/app';

@Component({
  selector: 'app-shorts-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatDurationPipe, FormatStatusPipe],
  templateUrl: './shorts-admin.component.html',
  styleUrl: './shorts-admin.component.scss',
})
export class ShortsAdminComponent implements OnInit {
  readonly DEFAULT_CURRENCY = DEFAULT_CURRENCY;
  readonly activeTab = signal<'moderation' | 'all' | 'packages'>('moderation');
  readonly shorts = signal<ShortVideo[]>([]);
  readonly packages = signal<ShortsPackage[]>([]);
  readonly loading = signal(true);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly showCreatePackage = signal(false);
  readonly editingPackage = signal<ShortsPackage | null>(null);
  readonly rejectingShort = signal<ShortVideo | null>(null);
  readonly previewShort = signal<ShortVideo | null>(null);

  statusFilter = 'pending_review';
  rejectionReason = '';
  limit = 20;

  pkgForm = {
    name: '',
    quantity: 5,
    duration: 30,
    price: 500,
    maxVideoLength: 60,
    description: '',
  };

  constructor(private readonly shortsService: ShortsService) {}

  ngOnInit(): void {
    this.loadShorts('pending_review');
  }

  loadShorts(status?: string): void {
    this.loading.set(true);
    const params: Record<string, any> = {
      page: this.page(),
      limit: this.limit,
    };
    if (status) params['status'] = status;

    this.shortsService.adminListShorts(params).subscribe({
      next: (res) => {
        this.shorts.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(Math.ceil(res.total / this.limit));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadPackages(): void {
    this.shortsService.adminGetPackages().subscribe({
      next: (pkgs) => this.packages.set(pkgs),
    });
  }

  changePage(newPage: number): void {
    this.page.set(newPage);
    this.loadShorts(this.statusFilter || undefined);
  }

  approveShort(id: string): void {
    this.shortsService.adminApproveShort(id).subscribe({
      next: () => {
        this.shorts.update((list) =>
          list.map((s) => (s._id === id ? { ...s, status: 'active' } : s)),
        );
      },
    });
  }

  openRejectModal(short: ShortVideo): void {
    this.rejectingShort.set(short);
    this.rejectionReason = '';
  }

  confirmReject(): void {
    const short = this.rejectingShort();
    if (!short || !this.rejectionReason.trim()) return;

    this.shortsService.adminRejectShort(short._id, this.rejectionReason).subscribe({
      next: () => {
        this.shorts.update((list) =>
          list.map((s) =>
            s._id === short._id
              ? { ...s, status: 'rejected', rejectionReason: this.rejectionReason }
              : s,
          ),
        );
        this.rejectingShort.set(null);
      },
    });
  }

  deleteShort(id: string): void {
    if (!confirm('Are you sure you want to delete this short?')) return;
    this.shortsService.adminDeleteShort(id).subscribe({
      next: () => {
        this.shorts.update((list) => list.filter((s) => s._id !== id));
      },
    });
  }

  openPreview(short: ShortVideo): void {
    this.previewShort.set(short);
  }

  // Package management
  editPackage(pkg: ShortsPackage): void {
    this.editingPackage.set(pkg);
    this.pkgForm = {
      name: pkg.name,
      quantity: pkg.quantity,
      duration: pkg.duration,
      price: pkg.price,
      maxVideoLength: pkg.maxVideoLength,
      description: pkg.description || '',
    };
  }

  closePackageModal(): void {
    this.showCreatePackage.set(false);
    this.editingPackage.set(null);
    this.pkgForm = {
      name: '',
      quantity: 5,
      duration: 30,
      price: 500,
      maxVideoLength: 60,
      description: '',
    };
  }

  savePackage(): void {
    const editing = this.editingPackage();
    if (editing) {
      this.shortsService.adminUpdatePackage(editing._id, this.pkgForm as any).subscribe({
        next: () => {
          this.loadPackages();
          this.closePackageModal();
        },
      });
    } else {
      this.shortsService.adminCreatePackage(this.pkgForm as any).subscribe({
        next: () => {
          this.loadPackages();
          this.closePackageModal();
        },
      });
    }
  }

  togglePackageStatus(pkg: ShortsPackage): void {
    this.shortsService.adminUpdatePackage(pkg._id, { isActive: !pkg.isActive } as any).subscribe({
      next: () => this.loadPackages(),
    });
  }

  // Helpers
  getSellerName(short: ShortVideo): string {
    const s = short.sellerId as any;
    if (s?.profile) return `${s.profile.firstName || ''} ${s.profile.lastName || ''}`.trim();
    return 'Unknown';
  }

  getSellerContact(short: ShortVideo): string {
    const s = short.sellerId as any;
    return s?.email || s?.phone || '';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
