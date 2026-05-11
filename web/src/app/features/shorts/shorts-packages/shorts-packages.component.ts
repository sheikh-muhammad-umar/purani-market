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

  purchasePackage(pkg: ShortsPackage): void {
    // In a real app, this would open a payment modal
    if (confirm(`Purchase "${pkg.name}" for ${CURRENCY_SYMBOL} ${pkg.price}?`)) {
      this.shortsService.purchasePackage(pkg._id, 'manual').subscribe({
        next: () => {
          alert('Package purchased! Payment confirmation pending.');
          // Reload purchases
          this.shortsService.getMyPurchases().subscribe({
            next: (purchases) => this.purchases.set(purchases),
          });
        },
        error: (err) => {
          alert('Purchase failed');
        },
      });
    }
  }

  isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
