import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { ERROR_MSG } from '../../../core/constants/error-messages';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-write-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './write-review.component.html',
  styleUrls: ['./write-review.component.scss'],
})
export class WriteReviewComponent implements OnInit {
  readonly MAX_TEXT_LENGTH = 2000;

  readonly MAX_IMAGES = 2;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  readonly rating = signal(0);
  readonly hoverRating = signal(0);
  readonly text = signal('');
  readonly previews = signal<{ file: File; url: string }[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  /** The seller being reviewed. Required. */
  readonly sellerId = signal<string | null>(null);
  /** Optional listing that prompted the review, kept as context. */
  readonly productListingId = signal<string | null>(null);

  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.sellerId.set(params['sellerId'] || null);
    this.productListingId.set(params['listingId'] || null);
  }

  get textLength(): number {
    return this.text().length;
  }

  get isValid(): boolean {
    return (
      this.rating() >= 1 &&
      this.rating() <= 5 &&
      this.text().trim().length > 0 &&
      this.text().length <= this.MAX_TEXT_LENGTH &&
      !!this.sellerId()
    );
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

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-selecting the same file

    for (const file of files) {
      if (this.previews().length >= this.MAX_IMAGES) {
        this.error.set(`You can attach up to ${this.MAX_IMAGES} photos.`);
        break;
      }
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.error.set('Only JPEG, PNG, and WebP images are allowed.');
        continue;
      }
      if (file.size > this.MAX_FILE_SIZE) {
        this.error.set('Each photo must be 5MB or smaller.');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.previews.update((p) => [...p, { file, url: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.previews.update((p) => p.filter((_, i) => i !== index));
  }

  submit(): void {
    if (!this.isValid || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.reviewsService
      .submit({
        sellerId: this.sellerId()!,
        productListingId: this.productListingId() ?? undefined,
        rating: this.rating() as 1 | 2 | 3 | 4 | 5,
        text: this.text().trim(),
        images: this.previews().map((p) => p.file),
      })
      .subscribe({
        next: () => {
          this.success.set(true);
          this.submitting.set(false);
          this.toast.success('Review submitted — pending admin approval.');
        },
        error: (err) => {
          const message = ERROR_MSG.REVIEW_SUBMIT_FAILED;
          this.error.set(message);
          this.submitting.set(false);
          this.toast.error(message);
        },
      });
  }
}
