import { describe, it, expect } from 'vitest';
import { ListingImagePipe } from './listing-image.pipe';
import { PLACEHOLDER_IMAGE } from '../../core/constants/app';

/**
 * These cases previously lived on FavoritesListComponent.getImage(). They moved
 * here when the card markup was consolidated into ListingCardComponent, which
 * resolves images through this pipe.
 */
describe('ListingImagePipe', () => {
  const pipe = new ListingImagePipe();

  it('should prefer the thumbnail url', () => {
    expect(pipe.transform({ images: [{ url: 'full.jpg', thumbnailUrl: 'thumb.jpg' }] })).toBe(
      'thumb.jpg',
    );
  });

  it('should fall back to the full url when there is no thumbnail', () => {
    expect(pipe.transform({ images: [{ url: 'full.jpg', thumbnailUrl: '' }] })).toBe('full.jpg');
    expect(pipe.transform({ images: [{ url: 'full.jpg' }] })).toBe('full.jpg');
  });

  it('should fall back to the placeholder when the images array is empty', () => {
    expect(pipe.transform({ images: [] })).toBe(PLACEHOLDER_IMAGE);
  });

  it('should fall back to the placeholder when images is missing', () => {
    expect(pipe.transform({})).toBe(PLACEHOLDER_IMAGE);
  });

  it('should use the first image when several are present', () => {
    expect(
      pipe.transform({
        images: [
          { url: 'a.jpg', thumbnailUrl: 'a-thumb.jpg' },
          { url: 'b.jpg', thumbnailUrl: 'b-thumb.jpg' },
        ],
      }),
    ).toBe('a-thumb.jpg');
  });
});
