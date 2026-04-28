export interface NotificationCategoryMeta {
  label: string;
  icon: string;
  color: string;
}

export const NOTIFICATION_CATEGORIES: Record<string, NotificationCategoryMeta> = {
  promotions: { label: 'Promotions', icon: 'campaign', color: '#f39c12' },
  productUpdates: { label: 'Product Updates', icon: 'inventory_2', color: '#3498db' },
  packageAlerts: { label: 'Package Alerts', icon: 'redeem', color: '#9b59b6' },
  messages: { label: 'Messages', icon: 'chat_bubble_outline', color: '#0da5c3' },
  offers: { label: 'Offers', icon: 'local_offer', color: '#27ae60' },
};

export const DEFAULT_CATEGORY_META: NotificationCategoryMeta = {
  label: 'Notification',
  icon: 'notifications_none',
  color: 'var(--text-muted)',
};

export function getCategoryMeta(category: string): NotificationCategoryMeta {
  return NOTIFICATION_CATEGORIES[category] || DEFAULT_CATEGORY_META;
}
