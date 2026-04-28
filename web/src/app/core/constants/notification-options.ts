import { NOTIFICATION_CATEGORIES } from './notification-categories';

// ── Compose form options ────────────────────────────────────────

export const CHANNEL_OPTIONS = [
  { value: 'push', label: 'Push Notification' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Push + Email' },
] as const;

export const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'role', label: 'By Role' },
  { value: 'specific', label: 'Specific Users' },
] as const;

export const CATEGORY_OPTIONS = Object.entries(NOTIFICATION_CATEGORIES).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const ROLE_OPTIONS = [
  { value: 'user', label: 'Regular Users' },
  { value: 'admin', label: 'Admins' },
  { value: 'super_admin', label: 'Super Admins' },
] as const;

// ── Filter / sort options ───────────────────────────────────────

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'sent', label: 'Sent' },
  { value: 'sending', label: 'Sending' },
  { value: 'failed', label: 'Failed' },
  { value: 'draft', label: 'Draft' },
];

export const CHANNEL_FILTER_OPTIONS = [
  { value: '', label: 'All Channels' },
  { value: 'push', label: 'Push' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Push + Email' },
];

export const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: '-recipientCount', label: 'Most recipients' },
  { value: '-readCount', label: 'Most read' },
];

// ── Status display ──────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  sent: 'var(--success)',
  sending: 'var(--warning, #f39c12)',
  failed: 'var(--error)',
};

export const DEFAULT_STATUS_COLOR = 'var(--text-muted)';
