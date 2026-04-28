import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ChatRole,
  FaqCategory,
  type ChatMessage,
  type ChatSession,
  type FaqEntry,
} from './interfaces/chatbot.interfaces.js';
import {
  ESCALATION_THRESHOLD,
  SESSION_TTL_MS,
  GREETING_KEYWORDS,
  THANK_KEYWORDS,
  REPLY_GREETING,
  REPLY_THANKS,
  REPLY_ESCALATED,
  REPLY_ESCALATION_TRIGGER,
  REPLY_FALLBACK,
} from './constants/chatbot.constants.js';

export type {
  ChatMessage,
  ChatSession,
} from './interfaces/chatbot.interfaces.js';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly sessions = new Map<string, ChatSession>();

  private readonly faqs: readonly FaqEntry[] = [
    // Account management
    {
      keywords: ['register', 'sign up', 'create account', 'registration'],
      answer:
        'To register, click the "Sign Up" button and enter your email or phone number. You will receive a verification code to complete registration.',
      category: FaqCategory.ACCOUNT,
    },
    {
      keywords: ['login', 'sign in', 'log in', 'cannot login'],
      answer:
        'You can log in using your email/phone and password, or use Google/Facebook social login. If you forgot your password, use the "Forgot Password" link.',
      category: FaqCategory.ACCOUNT,
    },
    {
      keywords: [
        'password',
        'reset password',
        'forgot password',
        'change password',
      ],
      answer:
        'To reset your password, go to the login page and click "Forgot Password". Enter your email and we will send you a reset link valid for 30 minutes.',
      category: FaqCategory.ACCOUNT,
    },
    {
      keywords: ['delete account', 'remove account', 'deactivate'],
      answer:
        'To delete your account, please contact our support team. Note that this action is irreversible and all your data will be permanently removed.',
      category: FaqCategory.ACCOUNT,
    },
    {
      keywords: ['change email', 'update email'],
      answer:
        'Go to Settings > Account and click "Change Email". A verification link will be sent to your new email address. Your current email stays active until the new one is verified.',
      category: FaqCategory.ACCOUNT,
    },
    {
      keywords: ['change phone', 'update phone'],
      answer:
        'Go to Settings > Account and click "Change Phone". An OTP will be sent to your new phone number for verification.',
      category: FaqCategory.ACCOUNT,
    },
    // Product listing
    {
      keywords: ['post ad', 'create listing', 'sell', 'create ad', 'new ad'],
      answer:
        'To post an ad, click the "+" button, select a category, fill in the details, upload at least 2 photos, set your location, and submit. Your ad will be live shortly.',
      category: FaqCategory.LISTING,
    },
    {
      keywords: ['edit ad', 'update listing', 'modify ad'],
      answer:
        'Go to "My Ads" in your dashboard, find the listing you want to edit, and click "Edit". You can update the title, description, price, photos, and other details.',
      category: FaqCategory.LISTING,
    },
    {
      keywords: ['delete ad', 'remove listing', 'remove ad'],
      answer:
        'Go to "My Ads", find the listing, and click "Delete". The ad will be removed from search results but data is retained for 90 days.',
      category: FaqCategory.LISTING,
    },
    {
      keywords: ['ad limit', 'free ads', 'how many ads', 'posting limit'],
      answer:
        'You can post up to 10 free ads. To post more, you can purchase an ad package from the Packages section.',
      category: FaqCategory.LISTING,
    },
    {
      keywords: ['featured', 'promote', 'boost', 'featured ad'],
      answer:
        'Featured ads appear at the top of search results. Purchase a Featured Ad package from the Packages section, then select which ad to feature.',
      category: FaqCategory.LISTING,
    },
    // Platform policies
    {
      keywords: ['policy', 'rules', 'terms', 'guidelines', 'prohibited'],
      answer:
        'Our platform prohibits illegal items, counterfeit goods, and inappropriate content. Please review our Terms of Service for the complete list of policies.',
      category: FaqCategory.POLICY,
    },
    {
      keywords: ['report', 'scam', 'fraud', 'fake'],
      answer:
        'If you encounter a suspicious listing or user, use the "Report" button on the listing or profile page. Our moderation team will review it promptly.',
      category: FaqCategory.POLICY,
    },
    {
      keywords: ['payment', 'pay', 'jazzcash', 'easypaisa', 'card'],
      answer:
        'We support JazzCash, EasyPaisa, and Credit/Debit Card payments for purchasing ad packages. All transactions are encrypted and secure.',
      category: FaqCategory.POLICY,
    },
    {
      keywords: ['safety', 'safe', 'meet', 'meeting'],
      answer:
        'For your safety, always meet in public places, bring a friend, verify the product before paying, and never share personal financial information.',
      category: FaqCategory.POLICY,
    },
  ];

  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<{ reply: string; escalated: boolean }> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        messages: [],
        unresolvedTurns: 0,
        escalated: false,
        lastActivityAt: new Date(),
      };
      this.sessions.set(sessionId, session);
    }

    session.lastActivityAt = new Date();
    this.addMessage(session, ChatRole.USER, userMessage);

    if (session.escalated) {
      this.addMessage(session, ChatRole.BOT, REPLY_ESCALATED);
      return { reply: REPLY_ESCALATED, escalated: true };
    }

    const faqAnswer = this.findFaqAnswer(userMessage);

    if (faqAnswer) {
      session.unresolvedTurns = 0;
      this.addMessage(session, ChatRole.BOT, faqAnswer);
      return { reply: faqAnswer, escalated: false };
    }

    session.unresolvedTurns++;

    if (session.unresolvedTurns >= ESCALATION_THRESHOLD) {
      session.escalated = true;
      this.addMessage(session, ChatRole.BOT, REPLY_ESCALATION_TRIGGER);
      return { reply: REPLY_ESCALATION_TRIGGER, escalated: true };
    }

    this.addMessage(session, ChatRole.BOT, REPLY_FALLBACK);
    return { reply: REPLY_FALLBACK, escalated: false };
  }

  private addMessage(
    session: ChatSession,
    role: ChatRole,
    content: string,
  ): void {
    session.messages.push({ role, content, timestamp: new Date() });
  }

  private findFaqAnswer(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    if (GREETING_KEYWORDS.some((g) => lowerMessage.includes(g))) {
      return REPLY_GREETING;
    }

    if (THANK_KEYWORDS.some((t) => lowerMessage.includes(t))) {
      return REPLY_THANKS;
    }

    let bestMatch: FaqEntry | null = null;
    let bestScore = 0;

    for (const faq of this.faqs) {
      let score = 0;
      for (const keyword of faq.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    return bestMatch && bestScore > 0 ? bestMatch.answer : null;
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ─── Cron: Cleanup stale chatbot sessions (>24h inactive) ───

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  cleanupStaleSessions(): void {
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (session.lastActivityAt < cutoff) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} stale chatbot sessions`);
    }
  }
}
