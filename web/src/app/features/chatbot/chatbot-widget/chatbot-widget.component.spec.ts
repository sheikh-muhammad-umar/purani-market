import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ChatbotWidgetComponent } from './chatbot-widget.component';
import { ChatbotService, ChatbotResponse } from '../../../core/services/chatbot.service';

describe('ChatbotWidgetComponent', () => {
  let component: ChatbotWidgetComponent;
  let chatbotService: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    chatbotService = {
      sendMessage: vi
        .fn()
        .mockReturnValue(of({ reply: 'Hello!', escalate: false } as ChatbotResponse)),
    };

    component = new ChatbotWidgetComponent(chatbotService as unknown as ChatbotService);
    component.ngOnInit();
  });

  it('should create and generate a session id', () => {
    expect(component).toBeTruthy();
    expect(component.sessionId).toMatch(/^session-/);
  });

  it('should start with chat closed', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should toggle chat open and closed', () => {
    component.toggleChat();
    expect(component.isOpen()).toBe(true);
    component.toggleChat();
    expect(component.isOpen()).toBe(false);
  });

  it('should start with empty messages', () => {
    expect(component.messages().length).toBe(0);
  });

  it('should not send empty message', () => {
    component.messageText = '   ';
    component.sendMessage();
    expect(chatbotService.sendMessage).not.toHaveBeenCalled();
    expect(component.messages().length).toBe(0);
  });

  it('should send message and receive reply', () => {
    component.messageText = 'Hello';
    component.sendMessage();

    expect(chatbotService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hello',
        sessionId: component.sessionId,
        history: expect.arrayContaining([{ role: 'user', content: 'Hello' }]),
      }),
    );

    expect(component.messages().length).toBe(2);
    expect(component.messages()[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(component.messages()[1]).toEqual({ role: 'assistant', content: 'Hello!' });
    expect(component.sending()).toBe(false);
    expect(component.messageText).toBe('');
  });

  it('should clear input after sending', () => {
    component.messageText = 'Test';
    component.sendMessage();
    expect(component.messageText).toBe('');
  });

  it('should handle API error gracefully', () => {
    chatbotService.sendMessage.mockReturnValue(throwError(() => new Error('Network error')));
    component.messageText = 'Help';
    component.sendMessage();

    expect(component.messages().length).toBe(2);
    expect(component.messages()[1].role).toBe('assistant');
    expect(component.messages()[1].content).toContain('something went wrong');
    expect(component.sending()).toBe(false);
  });

  it('should send conversation history with each request', () => {
    chatbotService.sendMessage.mockReturnValue(of({ reply: 'Response 1' }));
    component.messageText = 'First';
    component.sendMessage();

    chatbotService.sendMessage.mockReturnValue(of({ reply: 'Response 2' }));
    component.messageText = 'Second';
    component.sendMessage();

    const lastCall = chatbotService.sendMessage.mock.calls[1][0];
    expect(lastCall.history.length).toBe(3); // user1, assistant1, user2
    expect(lastCall.history[0]).toEqual({ role: 'user', content: 'First' });
    expect(lastCall.history[1]).toEqual({ role: 'assistant', content: 'Response 1' });
    expect(lastCall.history[2]).toEqual({ role: 'user', content: 'Second' });
  });

  it('should escalate after 3 unresolved turns', () => {
    for (let i = 0; i < 3; i++) {
      chatbotService.sendMessage.mockReturnValue(of({ reply: `Reply ${i + 1}`, escalate: false }));
      component.messageText = `Question ${i + 1}`;
      component.sendMessage();
    }

    expect(component.escalated()).toBe(true);
    // Should have escalation message appended
    const msgs = component.messages();
    const lastAssistant = msgs[msgs.length - 1];
    expect(lastAssistant.role).toBe('assistant');
    expect(lastAssistant.content).toContain('human support agent');
  });

  it('should escalate immediately when backend signals escalation', () => {
    chatbotService.sendMessage.mockReturnValue(of({ reply: 'Escalating...', escalate: true }));
    component.messageText = 'Complex issue';
    component.sendMessage();

    expect(component.escalated()).toBe(true);
  });

  it('should prevent sending when escalated', () => {
    chatbotService.sendMessage.mockReturnValue(of({ reply: 'Escalating', escalate: true }));
    component.messageText = 'Issue';
    component.sendMessage();

    chatbotService.sendMessage.mockClear();
    component.messageText = 'Another message';
    component.sendMessage();
    expect(chatbotService.sendMessage).not.toHaveBeenCalled();
  });

  it('should send quick action message', () => {
    const action = component.quickActions[0];
    component.sendQuickAction(action);

    expect(chatbotService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: action.message }),
    );
  });

  it('should have three quick actions', () => {
    expect(component.quickActions.length).toBe(3);
    expect(component.quickActions.map((a) => a.label)).toEqual([
      'Account Help',
      'Listing Help',
      'Platform Policies',
    ]);
  });

  it('should reset chat state', () => {
    component.messageText = 'Hello';
    component.sendMessage();
    const oldSessionId = component.sessionId;

    component.resetChat();

    expect(component.messages().length).toBe(0);
    expect(component.escalated()).toBe(false);
    expect(component.sessionId).not.toBe(oldSessionId);
  });

  it('should not send while already sending', () => {
    // Simulate a pending request by not resolving
    chatbotService.sendMessage.mockReturnValue(of({ reply: 'ok' }));
    component.messageText = 'First';
    component.sending.set(true);

    component.sendMessage();
    // sendMessage should not be called because sending is true
    expect(chatbotService.sendMessage).not.toHaveBeenCalled();
  });
});
