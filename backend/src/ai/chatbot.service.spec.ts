import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatbotService],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
  });

  describe('processMessage', () => {
    it('should respond to greetings', async () => {
      const result = await service.processMessage('session1', 'Hello');

      expect(result.reply).toContain('Hello');
      expect(result.escalated).toBe(false);
    });

    it('should respond to account management FAQs', async () => {
      const result = await service.processMessage(
        'session1',
        'How do I register?',
      );

      expect(result.reply).toContain('Sign Up');
      expect(result.escalated).toBe(false);
    });

    it('should respond to password reset FAQ', async () => {
      const result = await service.processMessage(
        'session1',
        'I forgot my password',
      );

      expect(result.reply).toContain('Forgot Password');
      expect(result.escalated).toBe(false);
    });

    it('should respond to product listing FAQs', async () => {
      const result = await service.processMessage(
        'session1',
        'How do I post an ad?',
      );

      expect(result.reply).toContain('ad');
      expect(result.escalated).toBe(false);
    });

    it('should respond to ad limit FAQ', async () => {
      const result = await service.processMessage(
        'session1',
        'How many free ads can I post?',
      );

      expect(result.reply).toContain('10');
      expect(result.escalated).toBe(false);
    });

    it('should respond to platform policy FAQs', async () => {
      const result = await service.processMessage(
        'session1',
        'What are the platform rules?',
      );

      expect(result.reply).toContain('Terms of Service');
      expect(result.escalated).toBe(false);
    });

    it('should respond to payment FAQs', async () => {
      const result = await service.processMessage(
        'session1',
        'How do I pay with jazzcash?',
      );

      expect(result.reply).toContain('JazzCash');
      expect(result.escalated).toBe(false);
    });

    it('should respond to thank you messages', async () => {
      const result = await service.processMessage('session1', 'Thank you!');

      expect(result.reply).toContain('welcome');
      expect(result.escalated).toBe(false);
    });

    it('should return fallback for unrecognized messages', async () => {
      const result = await service.processMessage(
        'session1',
        'xyzzy random gibberish',
      );

      expect(result.reply).toContain('rephrase');
      expect(result.escalated).toBe(false);
    });

    it('should escalate after 3 unresolved turns', async () => {
      const sessionId = 'escalation-test';

      await service.processMessage(sessionId, 'xyzzy gibberish 1');
      await service.processMessage(sessionId, 'xyzzy gibberish 2');
      const result = await service.processMessage(
        sessionId,
        'xyzzy gibberish 3',
      );

      expect(result.escalated).toBe(true);
      expect(result.reply).toContain('human support');
    });

    it('should keep escalated state after escalation', async () => {
      const sessionId = 'escalated-session';

      await service.processMessage(sessionId, 'xyzzy 1');
      await service.processMessage(sessionId, 'xyzzy 2');
      await service.processMessage(sessionId, 'xyzzy 3');

      const result = await service.processMessage(sessionId, 'Hello again');

      expect(result.escalated).toBe(true);
      expect(result.reply).toContain('escalated');
    });

    it('should reset unresolved counter when FAQ is matched', async () => {
      const sessionId = 'reset-test';

      await service.processMessage(sessionId, 'xyzzy gibberish');
      await service.processMessage(sessionId, 'xyzzy gibberish');
      // This should match and reset the counter
      await service.processMessage(sessionId, 'How do I register?');
      // These should start counting from 0 again
      await service.processMessage(sessionId, 'xyzzy gibberish');
      const result = await service.processMessage(sessionId, 'xyzzy gibberish');

      expect(result.escalated).toBe(false);
    });

    it('should maintain conversation context within a session', async () => {
      const sessionId = 'context-test';

      await service.processMessage(sessionId, 'Hello');
      await service.processMessage(sessionId, 'How do I post an ad?');

      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.messages).toHaveLength(4); // 2 user + 2 bot
    });

    it('should create new session for unknown sessionId', async () => {
      const result = await service.processMessage('new-session', 'Hello');

      expect(result.reply).toBeDefined();
      const session = service.getSession('new-session');
      expect(session).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      expect(service.getSession('nonexistent')).toBeUndefined();
    });

    it('should return session after messages', async () => {
      await service.processMessage('test-session', 'Hello');
      const session = service.getSession('test-session');

      expect(session).toBeDefined();
      expect(session!.sessionId).toBe('test-session');
    });
  });

  describe('clearSession', () => {
    it('should remove session', async () => {
      await service.processMessage('clear-test', 'Hello');
      expect(service.getSession('clear-test')).toBeDefined();

      service.clearSession('clear-test');
      expect(service.getSession('clear-test')).toBeUndefined();
    });
  });
});
