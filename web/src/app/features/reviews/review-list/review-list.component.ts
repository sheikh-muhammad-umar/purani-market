import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReviewsService, ReviewsResponse } from '../../../core/services/reviews.service';
import { Review } from '../../../core/models';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [EmptyStateComponent, SkeletonComponent],
  templateUrl: './review-list.component.html',
  styleUrls: ['./review-list.component.scss'],
})
export class ReviewListComponent implements OnInit {
  readonly reviews = signal<Review[]>([]);
  readonly averageRating = signal(0);
  readonly totalReviews = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly listingId = signal<string | null>(null);
  readonly sellerId = signal<string | null>(null);

  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.listingId.set(params['listingId'] || null);
    this.sellerId.set(params['sellerId'] || null);
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading.set(true);
    this.error.set(null);

    const listingId = this.listingId();
    const sellerId = this.sellerId();

    if (!listingId && !sellerId) {
      this.error.set('No listing or seller specified.');
      this.loading.set(false);
      return;
    }

    const source$ = listingId
      ? this.reviewsService.getByListing(listingId)
      : this.reviewsService.getBySeller(sellerId!);

    source$.subscribe({
      next: (res: ReviewsResponse) => {
        this.reviews.set(res.data);
        this.averageRating.set(res.averageRating);
        this.totalReviews.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(ERROR_MSG.REVIEWS_LOAD_FAILED);
        this.loading.set(false);
      },
    });
  }

  getStars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getPageTitle(): string {
    if (this.listingId()) return 'Listing Reviews';
    if (this.sellerId()) return 'Seller Reviews';
    return 'Reviews';
  }
}
