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
