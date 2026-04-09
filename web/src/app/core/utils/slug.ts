/**
 * Generate a URL-safe slug from a title.
 * e.g. "Samsung Galaxy S21 FE 5G 256GB" → "samsung-galaxy-s21-fe-5g-256gb"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

/**
 * Build an SEO-friendly listing path segment: "{slug}-{id}"
 * Usage: ['/listings', listingSlug(listing)]
 */
export function listingSlug(listing: { _id: string; title: string }): string {
  const slug = slugify(listing.title);
  return slug ? `${slug}-${listing._id}` : listing._id;
}

/**
 * Extract the MongoDB ObjectId from a slug-id string.
 * Handles both "some-title-64a1b2c3d4e5f6" and plain "64a1b2c3d4e5f6".
 */
export function extractIdFromSlug(slugId: string): string {
  // MongoDB ObjectId is 24 hex chars
  const match = slugId.match(/([a-f0-9]{24})$/);
  return match ? match[1] : slugId;
}
