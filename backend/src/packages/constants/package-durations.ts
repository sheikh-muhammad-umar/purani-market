/**
 * Allowed package durations loaded from environment.
 * Configured via PACKAGE_DURATIONS env var (comma-separated days).
 * Default: 7, 15, 30
 */
export function getPackageDurations(): number[] {
  return (process.env.PACKAGE_DURATIONS || '7,15,30')
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d > 0);
}

/**
 * Allowed shorts package durations loaded from environment.
 * Configured via SHORTS_PACKAGE_DURATIONS env var (comma-separated days).
 * Default: 7, 15, 30, 60, 90
 */
export function getShortsDurations(): number[] {
  return (process.env.SHORTS_PACKAGE_DURATIONS || '7,15,30,60,90')
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d > 0);
}

/**
 * Allowed all-in-one (bundle) durations, from BUNDLE_PACKAGE_DURATIONS.
 * Default: 7, 15, 30, 60, 90
 *
 * Separate from {@link getPackageDurations} because a bundle includes shorts,
 * which have always been sold on longer terms than ad slots or featured ads. Tying
 * the two together would mean either denying bundles the 60 and 90 day terms or
 * silently opening them up for every single-purpose ad package too.
 */
export function getBundleDurations(): number[] {
  return (process.env.BUNDLE_PACKAGE_DURATIONS || '7,15,30,60,90')
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d > 0);
}

/**
 * Every duration acceptable on some kind of ad package.
 *
 * Used for the request-level check, which cannot always tell which set applies:
 * a PATCH may carry a new duration without restating the entitlements that decide
 * whether the package is a bundle. The exact set is enforced in the service, once
 * the package's resolved type is known.
 */
export function getAllPackageDurations(): number[] {
  return [...new Set([...getPackageDurations(), ...getBundleDurations()])].sort(
    (a, b) => a - b,
  );
}

/**
 * Base listing allowance used when configuration is unavailable.
 *
 * Mirrors the schema default on `User.baseListingLimit`; both exist so a seller
 * with no packages always has a sane limit.
 */
export const FALLBACK_LISTING_LIMIT = 10;
