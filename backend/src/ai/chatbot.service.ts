import { Injectable } from '@nestjs/common';

export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  unresolvedTurns: number;
  escalated: boolean;
}

interface FaqEntry {
  keywords: string[];
  answer: string;
  category: string;
}

@Injectable()
export class ChatbotService {
  private sessions = new Map<string, ChatSession>();

  private readonly faqs: FaqEntry[] = [
    // Account management
    {
      keywords: ['register', 'sign up', 'create account', 'registration'],
      answer:
        'To register, click the "Sign Up" button and enter your email or phone number. You will receive a verification code to complete registration.',
      category: 'account',
    },
    {
      keywords: ['login', 'sign in', 'log in', 'cannot login'],
      answer:
        'You can log in using your email/phone and password, or use Google/Facebook social login. If you forgot your password, use the "Forgot Password" link.',
      category: 'account',
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
      category: 'account',
    },
    {
      keywords: ['delete account', 'remove account', 'deactivate'],
      answer:
        'To delete your account, please contact our support team. Note that this action is irreversible and all your data will be permanently removed.',
      category: 'account',
    },
    {
      keywords: ['change email', 'update email'],
      answer:
        'Go to Settings > Account and click "Change Email". A verification link will be sent to your new email address. Your current email stays active until the new one is verified.',
      category: 'account',
    },
    {
      keywords: ['change phone', 'update phone'],
      answer:
        'Go to Settings > Account and click "Change Phone". An OTP will be sent to your new phone number for verification.',
      category: 'account',
    },
    // Product listing
    {
      keywords: ['post ad', 'create listing', 'sell', 'create ad', 'new ad'],
      answer:
        'To post an ad, click the "+" button, select a category, fill in the details, upload at least 2 photos, set your location, and submit. Your ad will be live shortly.',
      category: 'listing',
    },
    {
      keywords: ['edit ad', 'update listing', 'modify ad'],
      answer:
        'Go to "My Ads" in your dashboard, find the listing you want to edit, and click "Edit". You can update the title, description, price, photos, and other details.',
      category: 'listing',
    },
    {
      keywords: ['delete ad', 'remove listing', 'remove ad'],
      answer:
        'Go to "My Ads", find the listing, and click "Delete". The ad will be removed from search results but data is retained for 90 days.',
      category: 'listing',
    },
    {
      keywords: ['ad limit', 'free ads', 'how many ads', 'posting limit'],
      answer:
        'You can post up to 10 free ads. To post more, you can purchase an ad package from the Packages section.',
      category: 'listing',
    },
    {
      keywords: ['featured', 'promote', 'boost', 'featured ad'],
      answer:
        'Featured ads appear at the top of search results. Purchase a Featured Ad package from the Packages section, then select which ad to feature.',
      category: 'listing',
    },
    // Platform policies
    {
      keywords: ['policy', 'rules', 'terms', 'guidelines', 'prohibited'],
      answer:
        'Our platform prohibits illegal items, counterfeit goods, and inappropriate content. Please review our Terms of Service for the complete list of policies.',
      category: 'policy',
    },
    {
      keywords: ['report', 'scam', 'fraud', 'fake'],
      answer:
        'If you encounter a suspicious listing or user, use the "Report" button on the listing or profile page. Our moderation team will review it promptly.',
      category: 'policy',
    },
    {
      keywords: ['payment', 'pay', 'jazzcash', 'easypaisa', 'card'],
      answer:
        'We support JazzCash, EasyPaisa, and Credit/Debit Card payments for purchasing ad packages. All transactions are encrypted and secure.',
      category: 'policy',
    },
    {
      keywords: ['safety', 'safe', 'meet', 'meeting'],
      answer:
        'For your safety, always meet in public places, bring a friend, verify the product before paying, and never share personal financial information.',
      category: 'policy',
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
      };
      this.sessions.set(sessionId, session);
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    if (session.escalated) {
      const reply =
        'Your conversation has been escalated to human support. A support agent will be with you shortly.';
      session.messages.push({
        role: 'bot',
        content: reply,
        timestamp: new Date(),
      });
      return { reply, escalated: true };
    }

    // Find matching FAQ
    const reply = this.findFaqAnswer(userMessage, session);

    if (reply) {
      session.unresolvedTurns = 0;
      session.messages.push({
        role: 'bot',
        content: reply,
        timestamp: new Date(),
      });
      return { reply, escalated: false };
    }

    // No match found - increment unresolved turns
    session.unresolvedTurns++;

    if (session.unresolvedTurns >= 3) {
      session.escalated = true;
      const escalationReply =
        "I'm sorry I couldn't help with your question. Let me connect you with a human support agent who can assist you better.";
      session.messages.push({
        role: 'bot',
        content: escalationReply,
        timestamp: new Date(),
      });
      return { reply: escalationReply, escalated: true };
    }

    const fallbackReply =
      "I'm not sure I understand your question. Could you please rephrase it? I can help with account management, posting ads, and platform policies.";
    session.messages.push({
      role: 'bot',
      content: fallbackReply,
      timestamp: new Date(),
    });
    return { reply: fallbackReply, escalated: false };
  }

  private findFaqAnswer(message: string, session: ChatSession): string | null {
    const lowerMessage = message.toLowerCase();

    // Check for greetings
    const greetings = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
    ];
    if (greetings.some((g) => lowerMessage.includes(g))) {
      return 'Hello! How can I help you today? I can assist with account management, posting ads, and platform policies.';
    }

    // Check for thank you
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      return "You're welcome! Is there anything else I can help you with?";
    }

    // Score each FAQ entry
    let bestMatch: FaqEntry | null = null;
    let bestScore = 0;

    for (const faq of this.faqs) {
      let score = 0;
      for (const keyword of faq.keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length; // Multi-word keywords score higher
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
}
