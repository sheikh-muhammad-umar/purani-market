/** Precomputed view model for a single conversation row in the list. */
export interface ConversationView {
  id: string;
  routerLink: string;
  title: string;
  price: string;
  image: string;
  status: string;
  statusLabel: string;
  isActive: boolean;
  timeAgo: string;
  preview: string;
  unreadCount: number;
}
