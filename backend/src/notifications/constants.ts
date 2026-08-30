/**
 * Socket event emitted when a notification lands in a user's inbox.
 *
 * Shared with the web client, which listens for this name to refresh the bell.
 * Changing it requires the same change in
 * `web/src/app/core/constants/realtime-events.ts`.
 */
export const NOTIFICATION_SOCKET_EVENT = 'notification';
