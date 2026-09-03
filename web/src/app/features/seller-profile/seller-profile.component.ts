import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { UsersService, PublicSellerProfile } from '../../core/services/users.service';
import { ActivityTrackerService } from '../../core/services/activity-tracker.service';
import { TrackingEvent } from '../../core/enums/tracking-events';
import { ListingsService } from '../../core/services/listings.service';
import { ShortsService, ShortVideo } from '../../core/services/shorts.service';
import { AuthService } from '../../core/auth/auth.service';
import { LoginModalService } from '../../shared/components/login-modal/login-modal.service';
import { Listing } from '../../core/models';
import { TAB, TabType } from '../../core/constants/enums';
import { VerificationBadgesComponent } from '../../shared/components/verification-badges/verification-badges.component';
import { ListingCardComponent } from '../../shared/components/listing-card/listing-card.component';
import { ShortCardComponent } from '../../shared/components/short-card/short-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ReportModalComponent } from '../../shared/components/report-modal/report-modal.component';
import { ReportTargetType } from '../../core/models/report.model';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { SellerReviewsComponent } from '../reviews/seller-reviews/seller-reviews.component';
import { extractIdFromSlug } from '../../core/utils/slug';

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [
    CommonModule,
    VerificationBadgesComponent,
    ListingCardComponent,
    ShortCardComponent,
    EmptyStateComponent,
    ReportModalComponent,
    StarRatingComponent,
    SellerReviewsComponent,
  ],
  templateUrl: './seller-profile.component.html',
  styleUrl: './seller-profile.component.scss',
})
export class SellerProfileComponent implements OnInit {
  readonly TAB = TAB;
  readonly loading = signal(true);
  readonly seller = signal<PublicSellerProfile | null>(null);
  readonly listings = signal<Listing[]>([]);
  readonly shorts = signal<ShortVideo[]>([]);
  readonly totalListings = signal(0);
  readonly totalShorts = signal(0);
  readonly activeTab = signal<TabType>(TAB.LISTINGS);

  private sellerId = '';
  private readonly tracker = inject(ActivityTrackerService);
  private readonly authService = inject(AuthService);
  private readonly loginModal = inject(LoginModalService);

  // ── Reporting ─────────────────────────────────────────────────
  readonly ReportTargetType = ReportTargetType;
  readonly showReportModal = signal(false);

  /** Show the report action to signed-in visitors who aren't this seller. */
  readonly canReport = computed(() => {
    const seller = this.seller();
    if (!seller) return false;
    const user = this.authService.user();
    return !user || user._id !== seller._id;
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly usersService: UsersService,
    private readonly listingsService: ListingsService,
    private readonly shortsService: ShortsService,
  ) {}

  openReport(): void {
    if (!this.authService.isAuthenticated()) {
      this.loginModal.open(`/seller/${this.sellerId}`);
      return;
    }
    this.showReportModal.set(true);
  }

  closeReport(): void {
    this.showReportModal.set(false);
  }

  /** Open the review form for this seller (signing in first if needed). */
  rateSeller(): void {
    if (!this.authService.isAuthenticated()) {
      this.loginModal.open(`/seller/${this.sellerId}`);
      return;
    }
    this.router.navigate(['/reviews/write'], {
      queryParams: { sellerId: this.sellerId },
    });
  }

  ngOnInit(): void {
    const rawParam = this.route.snapshot.paramMap.get('id') || '';
    this.sellerId = extractIdFromSlug(rawParam);
    if (this.sellerId) {
      this.loadProfile();
      this.loadListings();
      this.loadShorts();
    }
  }

  private loadProfile(): void {
    this.usersService.getPublicProfile(this.sellerId).subscribe({
      next: (data) => {
        this.seller.set(data);
        this.loading.set(false);
        // Recorded once the profile resolves, so a bad id is not counted as a view.
        this.tracker.track(TrackingEvent.SELLER_PROFILE_VIEW, {
          metadata: { sellerId: this.sellerId, sellerName: data.name },
        });
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadListings(): void {
    this.listingsService.getBySeller(this.sellerId).subscribe({
      next: (res) => {
        this.listings.set(res.data);
        this.totalListings.set(res.total);
      },
    });
  }

  private loadShorts(): void {
    this.shortsService.getSellerShorts(this.sellerId).subscribe({
      next: (res) => {
        this.shorts.set(res.data);
        this.totalShorts.set(res.total);
      },
    });
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  }
}
