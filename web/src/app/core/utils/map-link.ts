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
 * Builds a Google Maps embed URL from a map link.
 * Extracts coordinates or place name; falls back to a city/area query.
 */
export function buildMapEmbedUrl(mapLink: string, fallbackQuery?: string): string {
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
