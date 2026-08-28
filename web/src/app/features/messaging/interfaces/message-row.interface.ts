import { Message } from '../../../core/models';

/** Delivery state of an outgoing message, used to drive the bubble's meta row. */
export type MessageDeliveryStatus = 'pending' | 'failed' | 'sent' | 'read';

/**
 * One rendered row in the thread.
 *
 * The thread is a flat list of rows rather than a list of messages so that day
 * separators sit in the same `@for` as the bubbles. Grouping flags are computed
 * once here instead of being recalculated by template method calls on every
 * change-detection pass.
 */
export interface MessageRow {
  /** Stable key for `track`. */
  readonly key: string;

  /** `day` renders a date divider; `message` renders a bubble. */
  readonly kind: 'day' | 'message';

  /** Divider text, e.g. "Today". Only set when `kind` is `day`. */
  readonly label?: string;

  /** Only set when `kind` is `message`. */
  readonly message?: Message;

  /** True when the current user sent it. */
  readonly mine?: boolean;

  /** First bubble in a run by the same sender — gets the full corner radius. */
  readonly firstOfGroup?: boolean;

  /** Last bubble in a run — gets the tail and shows the timestamp. */
  readonly lastOfGroup?: boolean;

  /** Delivery state, for outgoing messages only. */
  readonly status?: MessageDeliveryStatus;
}
