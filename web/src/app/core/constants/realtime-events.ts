/**
 * Socket event names shared with the API.
 *
 * Each must match the server constant of the same name; the socket carries the
 * string, so a rename on one side silently stops delivery on the other.
 * `notification` is emitted by the backend's `NOTIFICATION_SOCKET_EVENT`
 * (`src/notifications/constants.ts`).
 */
export const REALTIME_EVENT = {
  /** A notification landed in this user's inbox. */
  NOTIFICATION: 'notification',
  /** A message arrived in a conversation this user takes part in. */
  NEW_MESSAGE: 'newMessage',
} as const;
