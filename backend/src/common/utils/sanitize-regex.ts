/**
 * Escape special regex characters in a user-supplied string
 * to prevent ReDoS and filter bypass attacks.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive exact-match regex from user input.
 * Equivalent to `new RegExp('^value$', 'i')` but safe from injection.
 */
export function exactMatchRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

/**
 * Build a case-insensitive contains regex from user input.
 * Equivalent to `new RegExp(value, 'i')` but safe from injection.
 */
export function containsRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value), 'i');
}
