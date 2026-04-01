import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';

@Component({
  selector: 'app-write-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './write-review.component.html',
  styleUrls: ['./write-review.component.scss'],
})
export class WriteReviewComponent implements OnInit {
  readonly MAX_TEXT_LENGTH = 2000;

  readonly rating = signal(0);
  readonly hoverRating = signal(0);
  readonly text = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly productListingId = signal<string | null>(null);

  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.productListingId.set(params['listingId'] || null);
  }

  get textLength(): number {
    return this.text().length;
  }

  get isValid(): boolean {
    return this.rating() >= 1 && this.rating() <= 5
      && this.text().trim().length > 0
      && this.text().length <= this.MAX_TEXT_LENGTH
      && !!this.productListingId();
  }

  stars: number[] = [1, 2, 3, 4, 5];

  setRating(value: number): void {
    this.rating.set(value);
  }

  setHover(value: number): void {
    this.hoverRating.set(value);
  }

  clearHover(): void {
    this.hoverRating.set(0);
  }

  isStarFilled(star: number): boolean {
    const active = this.hoverRating() || this.rating();
    return star <= active;
  }

  onTextChange(value: string): void {
    if (value.length <= this.MAX_TEXT_LENGTH) {
      this.text.set(value);
    } else {
      this.text.set(value.substring(0, this.MAX_TEXT_LENGTH));
    }
  }

  submit(): void {
    if (!this.isValid || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.reviewsService.submit({
      productListingId: this.productListingId()!,
      rating: this.rating() as 1 | 2 | 3 | 4 | 5,
      text: this.text().trim(),
    }).subscribe({
      next: () => {
        this.success.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        const message = err?.error?.message || 'Failed to submit review. Please try again.';
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}
