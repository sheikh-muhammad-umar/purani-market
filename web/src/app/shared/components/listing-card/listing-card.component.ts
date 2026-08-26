import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ListingCondition,
  ListingImage,
  ListingLocation,
  ListingPrice,
  ListingStatus,
} from '../../../core/models/listing.model';
import { ROUTES } from '../../../core/constants/routes';
import { VERIFIED_SELLER_TOOLTIP } from '../../../core/constants/app';
import { ListingImagePipe } from '../../pipes/listing-image.pipe';
import { ListingUrlPipe } from '../../pipes/listing-url.pipe';
import { PriceFormatPipe } from '../../pipes/price-format.pipe';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * The minimum shape this card renders.
 *
 * Deliberately narrower than `Listing` so partially-populated payloads such as
 * `FavoriteListingPopulated` can be passed without a cast. Anything satisfying
 * this contract works.
 */
export interface ListingCardData {
  _id: string;
  title: string;
  price: ListingPrice;
  images?: ListingImage[];
  location?: ListingLocation;
  condition?: ListingCondition;
  status?: ListingStatus;
  isFeatured?: boolean;
  sellerVerified?: boolean;
  createdAt?: Date | string;
  viewCount?: number;
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
};

/** Only states a buyer needs flagged over the image. `active` gets no label. */
const STATUS_LABELS: Record<string, string> = {
  sold: 'Sold',
  reserved: 'Reserved',
  expired: 'Expired',
  inactive: 'Unavailable',
  rejected: 'Unavailable',
};

/**
 * The single listing card used across home, search, favorites and seller
 * profiles. Replaces six divergent per-feature implementations.
 *
 * Set `loading` to render a placeholder with identical geometry, so the
 * skeleton can never drift from the real card.
 *
 * Markup uses the stretched-link pattern: the title is the only anchor, and its
 * `::after` covers the card so the whole surface is clickable. This keeps the
 * favourite button focusable on its own rather than nesting a button inside a
 * link, which is invalid and unreachable by keyboard.
 *
 * Usage:
 *   <app-listing-card [listing]="listing" [showFavorite]="true"
 *                     [favorited]="isSaved(listing)"
 *                     (favoriteToggled)="toggleSave($event)" />
 */
@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [
    RouterLink,
    ListingImagePipe,
    ListingUrlPipe,
    PriceFormatPipe,
    DateFormatPipe,
    TooltipDirective,
    SkeletonComponent,
  ],
  templateUrl: './listing-card.component.html',
  styleUrls: ['./listing-card.component.scss'],
})
export class ListingCardComponent {
  protected readonly ROUTES = ROUTES;
  protected readonly VERIFIED_SELLER_TOOLTIP = VERIFIED_SELLER_TOOLTIP;

  /** The listing to render. Ignored while `loading` is true. */
  readonly listing = input<ListingCardData | null>(null);

  /** Render a shimmer placeholder instead of content. */
  readonly loading = input(false);

  /** Show the favourite toggle in the top-right corner. */
  readonly showFavorite = input(false);

  /** Current saved state of the favourite toggle. */
  readonly favorited = input(false);

  /** Show a spinner in place of the heart while a toggle is in flight. */
  readonly favoritePending = input(false);

  /** Show the condition pill (New / Used / Refurbished). */
  readonly showCondition = input(true);

  /** Show relative posted time in the footer row. */
  readonly showTime = input(false);

  /** Show the view count in the footer row. */
  readonly showViews = input(false);

  /**
   * Load the image eagerly with high priority. Set this on the first few
   * above-the-fold cards to improve Largest Contentful Paint.
   */
  readonly eager = input(false);

  /** CSS aspect-ratio for the media area. */
  readonly aspect = input('4 / 3');

  /** Emitted when the favourite toggle is activated. */
  readonly favoriteToggled = output<ListingCardData>();

  protected readonly conditionLabel = computed(() => {
    const condition = this.listing()?.condition;
    return condition ? (CONDITION_LABELS[condition] ?? '') : '';
  });

  /** Non-empty only for states worth calling out over the image. */
  protected readonly statusLabel = computed(() => {
    const status = this.listing()?.status;
    return status ? (STATUS_LABELS[status] ?? '') : '';
  });

  protected readonly locationLabel = computed(() => {
    const location = this.listing()?.location;
    if (!location) return '';
    return [location.area, location.city].filter(Boolean).join(', ') || 'Unknown';
  });

  protected onFavorite(event: Event): void {
    // The card surface is a stretched link, so the click must not bubble to it.
    event.preventDefault();
    event.stopPropagation();
    const listing = this.listing();
    if (listing) {
      this.favoriteToggled.emit(listing);
    }
  }
}
