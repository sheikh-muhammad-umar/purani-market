/** Determines if a star should be filled based on current rating and hover state */
export function isStarFilled(star: number, rating: number, hover: number): boolean {
  return star <= (hover || rating);
}

/** Formats a date string to a localized short date */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
