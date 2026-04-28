/** Max consecutive unresolved turns before escalating to human support */
export const ESCALATION_THRESHOLD = 3;

/** Stale session TTL in milliseconds (24 hours) */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Greetings that trigger a welcome response */
export const GREETING_KEYWORDS: readonly string[] = [
  'hello',
  'hi',
  'hey',
  'good morning',
  'good afternoon',
  'good evening',
] as const;

/** Thank-you keywords */
export const THANK_KEYWORDS: readonly string[] = ['thank', 'thanks'] as const;

/** Canned responses */
export const REPLY_GREETING =
  'Hello! How can I help you today? I can assist with account management, posting ads, and platform policies.';

export const REPLY_THANKS =
  "You're welcome! Is there anything else I can help you with?";

export const REPLY_ESCALATED =
  'Your conversation has been escalated to human support. A support agent will be with you shortly.';

export const REPLY_ESCALATION_TRIGGER =
  "I'm sorry I couldn't help with your question. Let me connect you with a human support agent who can assist you better.";

export const REPLY_FALLBACK =
  "I'm not sure I understand your question. Could you please rephrase it? I can help with account management, posting ads, and platform policies.";
