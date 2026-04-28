export enum ChatRole {
  USER = 'user',
  BOT = 'bot',
}

export enum FaqCategory {
  ACCOUNT = 'account',
  LISTING = 'listing',
  POLICY = 'policy',
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  unresolvedTurns: number;
  escalated: boolean;
  lastActivityAt: Date;
}

export interface FaqEntry {
  keywords: string[];
  answer: string;
  category: FaqCategory;
}
