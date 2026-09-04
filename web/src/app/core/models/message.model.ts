export interface ConversationListing {
  _id: string;
  title: string;
  price: { amount: number; currency: string };
  images: { url: string; thumbnailUrl: string }[];
  status: string;
}

export interface ConversationShort {
  _id: string;
  title?: string;
  description?: string;
  video: { thumbnailUrl?: string; url: string };
  status?: string;
}

/**
 * The other party on a conversation. The conversations endpoint populates
 * `buyerId`/`sellerId` with this subset of the user document, so these fields
 * arrive as objects there even though they are plain ids elsewhere.
 */
export interface ConversationParty {
  _id: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export interface Conversation {
  _id: string;
  productListingId: string | ConversationListing;
  shortVideoId?: string | ConversationShort;
  buyerId: string | ConversationParty;
  sellerId: string | ConversationParty;
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
