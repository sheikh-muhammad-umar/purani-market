/**
 * Coercion helpers for values that arrive from a query string.
 *
 * Express is configured with the extended query parser, so `?city[$ne]=x` does
 * not arrive as the string the TypeScript signature promises — it arrives as
 * `{ $ne: 'x' }`. Types are erased at runtime, so a parameter typed `string?`
 * silently carries an object straight into a Mongo filter, a `$regex`, or a
 * `.replace()` that then throws. Routes taking a validated DTO are protected by
 * the global pipe; these exist for the ones taking bare `@Query('name')`
 * parameters, where the pipe has no class to validate and does nothing.
 */

/**
 * A query value that is genuinely a non-empty string, or `undefined`.
 *
 * Anything else — an object, an array, a number — becomes `undefined` rather
 * than reaching the query, so an injected operator turns into an absent filter
 * instead of a match-everything one.
 */
export function asQueryString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A bounded page size.
 *
 * Always capped, because an uncapped `limit` is both mass extraction and a
 * memory denial-of-service in one parameter — and the cap belongs here rather
 * than at each call site, where it is easy to forget.
 */
export function asPageSize(
  value: unknown,
  options: { fallback: number; max: number },
): number {
  const parsed = Number(asQueryString(value) ?? value);
  if (!Number.isFinite(parsed)) return options.fallback;
  return Math.min(Math.max(1, Math.floor(parsed)), options.max);
}

/** A page number, floored at 1. `?page=abc` becomes page 1, not `NaN`. */
export function asPageNumber(value: unknown): number {
  const parsed = Number(asQueryString(value) ?? value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

/**
 * A sort field the caller is allowed to name.
 *
 * An arbitrary field reaching `.sort()` is two problems: an unindexed sort on a
 * large collection is a cheap denial-of-service, and ordering by a field the
 * projection hides still leaks its relative values, so it works as an inference
 * oracle over data the response never shows.
 */
export function asSortField<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = asQueryString(value);
  return candidate && (allowed as readonly string[]).includes(candidate)
    ? (candidate as T)
    : fallback;
}

/** Sort direction, defaulting to descending. */
export function asSortOrder(value: unknown): 'asc' | 'desc' {
  return asQueryString(value) === 'asc' ? 'asc' : 'desc';
}
