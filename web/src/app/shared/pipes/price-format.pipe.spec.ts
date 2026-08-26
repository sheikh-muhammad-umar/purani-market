import { describe, it, expect } from 'vitest';
import { PriceFormatPipe } from './price-format.pipe';
import { CURRENCY_SYMBOL } from '../../core/constants/app';

/**
 * Ported from FavoritesListComponent.formatPrice(), which was removed when the
 * card markup was consolidated into ListingCardComponent.
 */
describe('PriceFormatPipe', () => {
  const pipe = new PriceFormatPipe();

  it('should prefix the currency symbol and group thousands', () => {
    const formatted = pipe.transform(500000);
    expect(formatted).toContain(CURRENCY_SYMBOL);
    expect(formatted).toContain('500');
    expect(formatted).toBe(`${CURRENCY_SYMBOL} 500,000`);
  });

  it('should drop fractional digits', () => {
    expect(pipe.transform(1234.56)).toBe(`${CURRENCY_SYMBOL} 1,235`);
  });

  it('should handle zero', () => {
    expect(pipe.transform(0)).toBe(`${CURRENCY_SYMBOL} 0`);
  });

  it('should return an empty string for null and undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
