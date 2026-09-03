import { Component, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReviewsService } from '../../../core/services/reviews.service';
import { Review, ReviewAuthor } from '../../../core/models/review.model';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

/**
 * Reviews list for a seller: each review shows the reviewer, star rating,
 * comment, and any attached photos (click to enlarge). Self-contained and
 * driven by a `sellerId` input, so it can be dropped onto the seller profile
 * (or anywhere else) without route coupling.
 */
@Component({
  selector: 'app-seller-reviews',
  standalone: true,
  imports: [CommonModule, StarRatingComponent, EmptyStateComponent, SkeletonComponent],
  templateUrl: './seller-reviews.component.html',
  styleUrl: './seller-reviews.component.scss',
})
export class SellerReviewsComponent {
  readonly sellerId = input.required<string>();

  readonly reviews = signal<Review[]>([]);
  readonly averageRating = signal(0);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lightboxUrl = signal<string | null>(null);

  readonly skeletons = [1, 2, 3];

  constructor(private readonly reviewsService: ReviewsService) {
    // Re-fetch whenever the seller changes.
    effect(() => {
      const id = this.sellerId();
      if (id) this.load(id);
    });
  }

  private load(sellerId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.reviewsService.getBySeller(sellerId).subscribe({
      next: (res) => {
        this.reviews.set(res.data);
        this.averageRating.set(res.averageRating);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load reviews.');
        this.loading.set(false);
      },
    });
  }

  reviewerName(review: Review): string {
    const reviewer = review.reviewerId;
    if (reviewer && typeof reviewer === 'object') {
      const p = (reviewer as ReviewAuthor).profile;
      const full = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();
      if (full) return full;
    }
    return 'Anonymous';
  }

  reviewerAvatar(review: Review): string | null {
    const reviewer = review.reviewerId;
    if (reviewer && typeof reviewer === 'object') {
      return (reviewer as ReviewAuthor).profile?.avatar ?? null;
    }
    return null;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  openLightbox(url: string): void {
    this.lightboxUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxUrl.set(null);
  }
}
