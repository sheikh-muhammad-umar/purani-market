export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  BOTH = 'both',
}

export enum NotificationAudience {
  ALL = 'all',
  ROLE = 'role',
  SPECIFIC = 'specific',
}

export enum NotificationStatus {
  DRAFT = 'draft',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
}
