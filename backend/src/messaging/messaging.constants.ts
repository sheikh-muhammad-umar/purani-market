/** Messaging feature constants shared across backend chat services. */

/** Allowed image MIME types for chat media uploads. */
export const ALLOWED_IMAGE_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Allowed audio MIME types for voice note uploads. */
export const ALLOWED_AUDIO_MIMES: readonly string[] = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
];

/** Max chat image file size in bytes (10MB). */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Max voice note file size in bytes (5MB). */
export const MAX_VOICE_SIZE = 5 * 1024 * 1024;

/** Max voice note duration in seconds (5 minutes). */
export const MAX_VOICE_DURATION = 300;

/** MIME type used for compressed/output images. */
export const COMPRESSED_IMAGE_MIME = 'image/jpeg';
