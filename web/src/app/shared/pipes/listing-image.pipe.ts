import { Pipe, PipeTransform } from '@angular/core';
import { PLACEHOLDER_IMAGE } from '../../core/constants/app';

/**
 * Extracts the thumbnail URL from a listing's images array.
 * Falls back to the full-size URL, then to a placeholder.
 *
 * Usage: [src]="listing | listingImage"
 */
@Pipe({ name: 'listingImage', standalone: true, pure: true })
export class ListingImagePipe implements PipeTransform {
  transform(listing: { images?: { url: string; thumbnailUrl?: string }[] }): string {
    return listing.images?.[0]?.thumbnailUrl || listing.images?.[0]?.url || PLACEHOLDER_IMAGE;
  }
}
