import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PackagesService } from '../../../core/services/packages.service';
import { AdPackage, PaymentMethod } from '../../../core/models';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../../core/enums/tracking-events';
import {
  PAYMENT_METHOD_CONFIG,
  CURRENCY_SYMBOL,
  PACKAGE_TYPE_LABELS,
} from '../../../core/constants/app';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { ROUTES } from '../../../core/constants/routes';
import { PackageType } from '../../../core/constants/enums';
import { AppLoaderComponent } from '../../../shared/components/app-loader/app-loader.component';

export type PurchaseStep = 'details' | 'payment' | 'confirm';

@Component({
  selector: 'app-purchase-flow',
  standalone: true,
  imports: [CommonModule, RouterLink, AppLoaderComponent],
  templateUrl: './purchase-flow.component.html',
  styleUrls: ['./purchase-flow.component.scss'],
})
export class PurchaseFlowComponent implements OnInit {
  readonly ROUTES = ROUTES;
  readonly pkg = signal<AdPackage | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly step = signal<PurchaseStep>('details');
  readonly selectedPaymentMethod = signal<PaymentMethod | null>(null);
  readonly purchasing = signal(false);
  readonly purchaseError = signal<string | null>(null);

  private packageId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly packagesService: PackagesService,
    private readonly tracker: ActivityTrackerService,
    @Inject(DOCUMENT) private readonly doc: Document,
  ) {}

  ngOnInit(): void {
    this.packageId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.packageId) {
      this.loadPackage();
    } else {
      this.error.set('Invalid package ID.');
      this.loading.set(false);
    }
  }

  loadPackage(): void {
    this.loading.set(true);
    this.error.set(null);
    this.packagesService.getById(this.packageId).subscribe({
      next: (pkg) => {
        this.pkg.set(pkg);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(ERROR_MSG.PACKAGE_DETAILS_LOAD_FAILED);
        this.loading.set(false);
      },
    });
  }

  goToPayment(): void {
    this.step.set('payment');
  }

  selectPaymentMethod(method: PaymentMethod): void {
    this.selectedPaymentMethod.set(method);
  }

  goToConfirm(): void {
    if (this.selectedPaymentMethod()) {
      this.step.set('confirm');
    }
  }

  goBack(): void {
    const current = this.step();
    if (current === 'payment') this.step.set('details');
    else if (current === 'confirm') this.step.set('payment');
  }

  confirmPurchase(): void {
    const method = this.selectedPaymentMethod();
    if (!method) return;

    this.purchasing.set(true);
    this.purchaseError.set(null);

    // Recorded before the request, not after: the gap between attempts and
    // completed purchases is where a broken payment method shows up. Only the
    // success path was tracked before, so failures were invisible.
    this.tracker.track(TrackingEvent.PAYMENT_ATTEMPT, {
      metadata: {
        packageId: this.packageId,
        packageName: this.pkg()?.name,
        amount: this.pkg()?.defaultPrice,
        paymentMethod: method,
      },
    });

    this.packagesService
      .purchase({
        packageId: this.packageId,
        paymentMethod: method,
      })
      .subscribe({
        next: (res) => {
          this.purchasing.set(false);
          this.tracker.track(TrackingEvent.PACKAGE_PURCHASE, {
            metadata: {
              packageId: this.packageId,
              packageName: this.pkg()?.name,
              amount: this.pkg()?.defaultPrice,
              paymentMethod: method,
            },
          });
          if (res.redirectUrl) {
            // Handing off to the payment gateway goes through DOCUMENT rather
            // than the global `window`, so the destination is injectable. jsdom
            // makes `location` and `location.href` non-configurable, leaving a
            // direct global write impossible to observe from a test.
            this.doc.location.href = res.redirectUrl;
          }
        },
        error: () => {
          this.purchaseError.set('Payment initiation failed. Please try again.');
          this.purchasing.set(false);
        },
      });
  }

  formatPrice(price: number): string {
    return `${CURRENCY_SYMBOL} ${price.toLocaleString()}`;
  }

  getTypeLabel(type: string): string {
    return PACKAGE_TYPE_LABELS[type] ?? type;
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_CONFIG[method]?.label ?? method;
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    return PAYMENT_METHOD_CONFIG[method]?.icon ?? 'payments';
  }

  getStepNumber(): number {
    switch (this.step()) {
      case 'details':
        return 1;
      case 'payment':
        return 2;
      case 'confirm':
        return 3;
    }
  }
}
