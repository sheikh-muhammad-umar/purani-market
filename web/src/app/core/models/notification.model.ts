export interface UserNotification {
  _id: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  createdAt: string;
  /** Optional deep-link payload, e.g. { type: 'short_approved', shortId }. */
  data?: {
    type?: string;
    shortId?: string;
    listingId?: string;
    conversationId?: string;
    [key: string]: unknown;
  };
}

export interface UserNotificationResponse {
  data: UserNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface AdminNotification {
  _id: string;
  title: string;
  body: string;
  channel: string;
  audience: string;
  targetRole?: string;
  category: string;
  status: string;
  recipientCount: number;
  readCount: number;
  sentAt?: string;
  createdAt: string;
}

export interface AdminNotificationListResponse {
  data: AdminNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
