import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ShortsService,
  ShortsPackage,
  ShortsPackagePurchase,
} from '../../../core/services/shorts.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import { ROUTES } from '../../../core/constants/routes';
import { CURRENCY_SYMBOL } from '../../../core/constants/app';
import { PaymentStatus } from '../../../core/constants/enums';
import { ConfirmModalService } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-shorts-packages',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './shorts-packages.component.html',
  styleUrl: './shorts-packages.component.scss',
})
export class ShortsPackagesComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly CURRENCY_SYMBOL = CURRENCY_SYMBOL;
  readonly packages = signal<ShortsPackage[]>([]);
  readonly purchases = signal<ShortsPackagePurchase[]>([]);
  readonly loading = signal(true);

  constructor(
    private readonly shortsService: ShortsService,
    private readonly tracker: ActivityTrackerService,
    private readonly confirmModal: ConfirmModalService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.tracker.track(TrackingEvent.SHORT_PACKAGE_VIEW, {});
    this.shortsService.getAvailablePackages().subscribe({
      next: (pkgs) => {
        this.packages.set(pkgs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.shortsService.getMyPurchases().subscribe({
      next: (purchases) => this.purchases.set(purchases),
    });
  }

  async purchasePackage(pkg: ShortsPackage): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Confirm Purchase',
      message: `Purchase "${pkg.name}" for ${CURRENCY_SYMBOL} ${pkg.price}?`,
      confirmText: 'Purchase',
      cancelText: 'Cancel',
      variant: 'info',
    });

    if (!confirmed) return;

    this.shortsService.purchasePackage(pkg._id, 'manual').subscribe({
      next: () => {
        this.tracker.track(TrackingEvent.SHORT_PACKAGE_PURCHASE, {
          metadata: { packageId: pkg._id, packageName: pkg.name, price: pkg.price },
        });
        this.toast.success('Package purchased! Payment confirmation pending.');
        this.shortsService.getMyPurchases().subscribe({
          next: (purchases) => this.purchases.set(purchases),
        });
      },
      error: () => {
        this.toast.error('Purchase failed. Please try again.');
      },
    });
  }

  isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }

  /** Paid, waiting on an admin to confirm it. */
  isAwaitingConfirmation(purchase: ShortsPackagePurchase): boolean {
    return purchase.paymentStatus === PaymentStatus.PENDING;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
