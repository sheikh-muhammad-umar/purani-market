import { Pipe, PipeTransform } from '@angular/core';
import { listingSlug } from '../../core/utils/slug';

/**
 * Generates an SEO-friendly slug-id for listing URLs.
 * Usage: [routerLink]="['/listings', listing | listingUrl]"
 */
@Pipe({ name: 'listingUrl', standalone: true })
export class ListingUrlPipe implements PipeTransform {
  transform(listing: { _id: string; title: string }): string {
    return listingSlug(listing);
  }
}
