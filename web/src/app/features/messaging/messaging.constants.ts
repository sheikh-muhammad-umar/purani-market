/** Messaging feature constants shared across chat components. */

import { ListingStatus } from '../../core/constants/enums';

/** Accepted image MIME types for the file picker. */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/** Voice recording MIME type. */
export const VOICE_MIME_TYPE = 'audio/webm';

/** Messages per page for pagination. */
export const MESSAGES_PAGE_SIZE = 20;

/** Typing indicator auto-dismiss timeout in ms. */
export const TYPING_TIMEOUT_MS = 3000;

/** Scroll-to-bottom delay in ms. */
export const SCROLL_DELAY_MS = 50;

/**
 * Consecutive messages from the same sender within this window are drawn as one
 * group: shared corner radius and a single timestamp on the last bubble.
 */
export const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * How close to the bottom the thread must be before an incoming message is
 * allowed to auto-scroll. Past this, jumping would yank the reader away from
 * the history they are looking at, so a "new messages" pill is shown instead.
 */
export const NEAR_BOTTOM_PX = 120;

/** Minimum gap between outgoing `typing` socket events. */
export const TYPING_THROTTLE_MS = 1500;

/** Skeleton placeholder indices for loading states. */
export const SKELETON_ITEMS = [1, 2, 3, 4, 5] as const;

/** Conversation list skeleton placeholder indices. */
export const CONVERSATION_SKELETON_ITEMS = [1, 2, 3, 4, 5] as const;

/** Waveform bar indices for voice message visualization. */
export const WAVEFORM_BARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** User-facing labels for non-active listing statuses in conversation list. */
export const LISTING_STATUS_LABELS: Partial<Record<ListingStatus, string>> = {
  [ListingStatus.SOLD]: 'Sold',
  [ListingStatus.DELETED]: 'Deleted',
  [ListingStatus.EXPIRED]: 'Expired',
  [ListingStatus.INACTIVE]: 'Inactive',
  [ListingStatus.PENDING_REVIEW]: 'Unavailable',
  [ListingStatus.REJECTED]: 'Unavailable',
  [ListingStatus.RESERVED]: 'Reserved',
};

/** Chat-disabled reason labels for the chat window. */
export const CHAT_DISABLED_LABELS: Partial<Record<ListingStatus, string>> = {
  [ListingStatus.SOLD]: 'This listing has been sold.',
  [ListingStatus.DELETED]: 'This listing has been deleted.',
  [ListingStatus.EXPIRED]: 'This listing has expired.',
};
