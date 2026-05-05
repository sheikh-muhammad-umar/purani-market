import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-promo-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './promo-banner.component.html',
  styleUrls: ['./promo-banner.component.scss'],
})
export class PromoBannerComponent {
  /** Badge text (e.g. "New", "Tip") */
  readonly badge = input('');

  /** Main message */
  readonly message = input('');

  /** CTA link text */
  readonly ctaText = input('');

  /** CTA route path */
  readonly ctaLink = input('');
}
