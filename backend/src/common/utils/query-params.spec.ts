import {
  asPageNumber,
  asPageSize,
  asQueryString,
  asSortField,
  asSortOrder,
} from './query-params';

describe('query parameter coercion', () => {
  describe('asQueryString', () => {
    it('passes a plain string through, trimmed', () => {
      expect(asQueryString('  Lahore ')).toBe('Lahore');
    });

    it.each([
      // The extended query parser turns ?city[$ne]=x into this shape, which is
      // what let an operator reach a Mongo filter.
      [{ $ne: 'x' }],
      [{ $regex: '.*' }],
      [['a', 'b']],
      [42],
      [null],
      [undefined],
      [''],
      ['   '],
    ])('rejects %p', (value) => {
      expect(asQueryString(value)).toBeUndefined();
    });
  });

  describe('asPageSize', () => {
    it('caps the requested size', () => {
      // Uncapped, this reached $sample as a size — mass extraction and a memory
      // exhaustion in one parameter.
      expect(asPageSize('1000000', { fallback: 10, max: 50 })).toBe(50);
    });

    it('floors at one and ignores fractions', () => {
      expect(asPageSize('0', { fallback: 10, max: 50 })).toBe(1);
      expect(asPageSize('-5', { fallback: 10, max: 50 })).toBe(1);
      expect(asPageSize('7.9', { fallback: 10, max: 50 })).toBe(7);
    });

    it('falls back when the value is not a number', () => {
      // `parseInt('abc')` used to yield NaN and propagate into skip/limit.
      expect(asPageSize('abc', { fallback: 10, max: 50 })).toBe(10);
      expect(asPageSize({ $gt: 1 }, { fallback: 10, max: 50 })).toBe(10);
      expect(asPageSize(undefined, { fallback: 10, max: 50 })).toBe(10);
    });
  });

  describe('asPageNumber', () => {
    it('floors at one', () => {
      expect(asPageNumber('0')).toBe(1);
      expect(asPageNumber('abc')).toBe(1);
      expect(asPageNumber({ $ne: null })).toBe(1);
    });

    it('accepts a real page', () => {
      expect(asPageNumber('4')).toBe(4);
    });
  });

  describe('asSortField', () => {
    const allowed = ['createdAt', 'price.amount'] as const;

    it('accepts an allowed field', () => {
      expect(asSortField('price.amount', allowed, 'createdAt')).toBe(
        'price.amount',
      );
    });

    it.each(['sellerId', 'contactInfo.phone', 'passwordHash', 'anything'])(
      'falls back for %p',
      (field) => {
        // Sorting by a hidden field still reveals its ordering, so an arbitrary
        // field name is an inference oracle as well as a slow query.
        expect(asSortField(field, allowed, 'createdAt')).toBe('createdAt');
      },
    );

    it('falls back for an injected object', () => {
      expect(asSortField({ $ne: 1 }, allowed, 'createdAt')).toBe('createdAt');
    });
  });

  describe('asSortOrder', () => {
    it('only recognises asc', () => {
      expect(asSortOrder('asc')).toBe('asc');
      expect(asSortOrder('desc')).toBe('desc');
      expect(asSortOrder('DESC')).toBe('desc');
      expect(asSortOrder({ $ne: 1 })).toBe('desc');
    });
  });
});
