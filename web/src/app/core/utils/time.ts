/**
 * Time conversion utilities to avoid magic number calculations like `* 24 * 60 * 60 * 1000`.
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Convert days to milliseconds */
export function daysToMs(days: number): number {
  return days * MS_PER_DAY;
}

/** Convert hours to milliseconds */
export function hoursToMs(hours: number): number {
  return hours * MS_PER_HOUR;
}

/** Convert minutes to milliseconds */
export function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}

/** Get a Date that is `days` days from now (positive = future, negative = past) */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + daysToMs(days));
}

/** Get a Date that is `days` days ago */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - daysToMs(days));
}
