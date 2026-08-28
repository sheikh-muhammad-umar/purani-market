import { ValidatorFn, AbstractControl } from '@angular/forms';

/** Allowed map link URL pattern (Google Maps & Apple Maps, https only) */
export const MAP_LINK_PATTERN =
  /^https:\/\/(www\.)?(google\.[a-z.]+\/(maps|maps\/place|maps\/dir|maps\/search|maps\/@)|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com)/;

/** Coordinate extraction patterns for map URLs */
const COORD_PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
];

const PLACE_PATTERN = /\/place\/([^/@]+)/;

/**
 * Pulls a latitude/longitude pair out of a Google or Apple Maps URL.
 *
 * Reuses the same patterns as the embed builder, but returns the numbers so a
 * caller can store the point rather than only display it. Returns null when the
 * URL carries no coordinates — a `/place/Name` link with no `@lat,lng` part, for
 * instance, which can be embedded but not resolved to a point client-side.
 */
export function extractCoordsFromMapLink(
  mapLink: string,
): { latitude: number; longitude: number } | null {
  if (!mapLink || !mapLink.startsWith('https://')) return null;
  if (!MAP_LINK_PATTERN.test(mapLink)) return null;

  for (const pattern of COORD_PATTERNS) {
    const match = mapLink.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return { latitude, longitude };
    }
  }
  return null;
}

/**
 * Builds a Google Maps embed URL from a map link.
 * Extracts coordinates or place name; falls back to a city/area query.
 * Always returns an https:// URL — never passes through user input directly.
 */
export function buildMapEmbedUrl(mapLink: string, fallbackQuery?: string): string {
  // Only process https URLs to prevent javascript: or data: injection
  if (mapLink && !mapLink.startsWith('https://')) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery || '')}&z=15&output=embed`;
  }

  for (const pattern of COORD_PATTERNS) {
    const match = mapLink.match(pattern);
    if (match) {
      return `https://maps.google.com/maps?q=${match[1]},${match[2]}&z=15&output=embed`;
    }
  }

  const placeMatch = mapLink.match(PLACE_PATTERN);
  if (placeMatch) {
    const query = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
  }

  const query = fallbackQuery || '';
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}

/** Angular form validator for map link URLs (optional field). */
export function mapLinkValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value?.trim();
    if (!value) return null;
    return MAP_LINK_PATTERN.test(value) ? null : { invalidMapLink: true };
  };
}
