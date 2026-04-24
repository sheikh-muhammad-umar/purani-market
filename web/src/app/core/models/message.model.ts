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

export type MessageType = 'text' | 'image' | 'voice' | 'location';

export interface MediaPayload {
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  mimeType?: string;
  fileSize?: number;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  address?: string;
  isLive?: boolean;
  expiresAt?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  type?: MessageType;
  content: string;
  media?: MediaPayload;
  location?: LocationPayload;
  isRead: boolean;
  createdAt: Date;
}
