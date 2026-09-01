import { randomRef } from './random-ref';

describe('randomRef', () => {
  it('returns the requested length', () => {
    expect(randomRef(5)).toHaveLength(5);
    expect(randomRef(1)).toHaveLength(1);
    expect(randomRef(0)).toBe('');
  });

  it('uses only characters a gateway reference accepts', () => {
    // pp_TxnRefNo and EasyPaisa's orderRefNum are uppercase alphanumeric.
    for (let i = 0; i < 200; i++) {
      expect(randomRef(8)).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it('does not repeat itself', () => {
    // The whole point is that a reference cannot be guessed, so collisions across
    // a small sample would defeat it. 5 chars of base36 is ~26 bits.
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(randomRef(5));
    expect(seen.size).toBeGreaterThan(1990);
  });
});
