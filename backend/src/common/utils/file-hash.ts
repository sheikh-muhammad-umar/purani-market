import { createHash } from 'crypto';

/**
 * Compute a SHA-256 hex digest of a Buffer.
 */
export function computeBufferHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
