/** Feedback-related constants */

export const STAR_RATINGS = [1, 2, 3, 4, 5] as const;

export const SKELETON_ITEMS = [1, 2, 3] as const;

export const MAX_FEEDBACK_COMMENT_LENGTH = 1000;

export const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below average',
  3: 'Average',
  4: 'Great!',
  5: 'Excellent!',
};

/** Confirmation modal messages */
export const FEEDBACK_CONFIRM = {
  TITLE: 'Submit Feedback',
  MESSAGE:
    'Once submitted, your feedback cannot be edited or removed. ' +
    'The seller will be notified and your feedback will be visible to other users. ' +
    'Are you sure you want to proceed?',
  CONFIRM_TEXT: 'Submit',
  CANCEL_TEXT: 'Go Back',
} as const;

/** Toast messages */
export const FEEDBACK_TOAST = {
  SUCCESS: 'Your feedback has been submitted successfully. The seller has been notified.',
  ERROR_FALLBACK: 'Failed to submit feedback. Please try again.',
} as const;

export const SELLER_FEEDBACK_TOAST = {
  LOAD_ERROR: 'Failed to load feedback. Please try again.',
} as const;
