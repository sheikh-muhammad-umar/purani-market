import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Random uppercase alphanumeric suffix for a gateway transaction reference.
 *
 * Uses `randomInt` from node:crypto rather than Math.random: the point is that a
 * reference cannot be predicted, and a seeded PRNG would undermine that.
 */
export function randomRef(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}
