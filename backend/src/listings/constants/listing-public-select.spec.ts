import { LISTING_PUBLIC_SELECT } from './index';

/**
 * The projection is a string, so a field slips back into public responses by
 * omission — there is nothing to fail. These assertions are the failure.
 */
describe('LISTING_PUBLIC_SELECT', () => {
  const excluded = LISTING_PUBLIC_SELECT.split(' ');

  it.each([
    // Seller contact details default to their account phone and email, so
    // including them let one unauthenticated loop over the list endpoint harvest
    // every seller on the platform.
    'contactInfo',
    // Moderation internals: why a listing was rejected, and by which package.
    'purchaseId',
    'rejectionReasonIds',
    'rejectionNote',
    'rejectedAt',
    'deactivatedAt',
    'deletionReason',
  ])('excludes %s from public list responses', (field) => {
    expect(excluded).toContain(`-${field}`);
  });

  it('only ever excludes, never includes', () => {
    // A single field without its minus turns the whole projection into an
    // inclusion list, which would silently drop everything else.
    expect(excluded.every((field) => field.startsWith('-'))).toBe(true);
  });
});
