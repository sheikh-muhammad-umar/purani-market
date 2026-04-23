import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PackagesService } from '../../../core/services/packages.service';
import { PackagePurchase, PaymentStatus } from '../../../core/models';
import {
  PaymentStatus as PaymentStatusEnum,
  PackageType as PackageTypeEnum,
  PaymentMethod as PaymentMethodEnum,
} from '../../../core/constants/enums';
import { CURRENCY_SYMBOL, PAYMENT_METHOD_CONFIG } from '../../../core/constants/app';
import { ROUTES } from '../../../core/constants/routes';

@Component({
  selector: 'app-my-packages',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-packages.component.html',
  styleUrls: ['./my-packages.component.scss'],
})
export class MyPackagesComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly purchases = signal<PackagePurchase[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'active' | 'history'>('active');

  constructor(private readonly packagesService: PackagesService) {}

  ngOnInit(): void {
    this.loadPurchases();
  }

  loadPurchases(): void {
    this.loading.set(true);
    this.error.set(null);
    this.packagesService.getMyPurchases().subscribe({
      next: (res) => {
        this.purchases.set(Array.isArray(res) ? res : (res.data ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load your packages. Please try again.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'active' | 'history'): void {
    this.activeTab.set(tab);
  }

  activePurchases(): PackagePurchase[] {
    const now = new Date();
    return this.purchases().filter(
      (p) =>
        p.paymentStatus === PaymentStatusEnum.COMPLETED &&
        p.expiresAt &&
        new Date(p.expiresAt) > now &&
        p.remainingQuantity > 0,
    );
  }

  historyPurchases(): PackagePurchase[] {
    const now = new Date();
    return this.purchases().filter(
      (p) =>
        p.paymentStatus !== PaymentStatusEnum.COMPLETED ||
        !p.expiresAt ||
        new Date(p.expiresAt) <= now ||
        p.remainingQuantity <= 0,
    );
  }

  getStatusBadgeClass(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatusEnum.COMPLETED:
        return 'badge-success';
      case PaymentStatusEnum.PENDING:
        return 'badge-pending';
      case PaymentStatusEnum.FAILED:
        return 'badge-error';
      case PaymentStatusEnum.REFUNDED:
        return 'badge-warning';
      default:
        return '';
    }
  }

  getTypeLabel(type: string): string {
    return type === PackageTypeEnum.FEATURED_ADS ? 'Featured Ads' : 'Ad Slots';
  }

  formatPrice(price: number): string {
    return `${CURRENCY_SYMBOL} ${price.toLocaleString()}`;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getRemainingDays(expiresAt: Date | string | undefined): number {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  getPaymentMethodLabel(method: string): string {
    return PAYMENT_METHOD_CONFIG[method]?.label ?? method;
  }
}
