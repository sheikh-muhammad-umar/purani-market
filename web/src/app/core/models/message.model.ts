export interface ConversationListing {
  _id: string;
  title: string;
  price: { amount: number; currency: string };
  images: { url: string; thumbnailUrl: string }[];
  status: string;
}

export interface Conversation {
  _id: string;
  productListingId: string | ConversationListing;
  buyerId: string;
  sellerId: string;
  lastMessageAt: Date;
  lastMessagePreview: string;
  createdAt: Date;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}
