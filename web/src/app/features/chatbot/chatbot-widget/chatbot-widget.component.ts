import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMessage, ChatbotResponse } from '../../../core/services/chatbot.service';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrls: ['./chatbot-widget.component.scss'],
})
export class ChatbotWidgetComponent implements OnInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  readonly isOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly sending = signal(false);
  readonly escalated = signal(false);

  messageText = '';
  sessionId = '';

  private unresolved = 0;

  readonly quickActions: { label: string; message: string }[] = [
    { label: 'Account Help', message: 'I need help with my account' },
    { label: 'Listing Help', message: 'I need help with my listing' },
    { label: 'Platform Policies', message: 'Tell me about platform policies' },
  ];

  constructor(readonly chatbotService: ChatbotService) {}

  ngOnInit(): void {
    this.sessionId = this.generateSessionId();
  }

  toggleChat(): void {
    this.isOpen.update((v) => !v);
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    if (!text || this.sending() || this.escalated()) return;

    this.appendMessage({ role: 'user', content: text });
    this.messageText = '';
    this.sending.set(true);

    const history = this.messages();

    this.chatbotService
      .sendMessage({ message: text, sessionId: this.sessionId, history })
      .subscribe({
        next: (res: ChatbotResponse) => {
          this.appendMessage({ role: 'assistant', content: res.reply });
          this.sending.set(false);

          if (res.escalate) {
            this.escalated.set(true);
          } else {
            this.unresolved++;
            if (this.unresolved >= 3) {
              this.appendMessage({
                role: 'assistant',
                content: 'It seems I\'m unable to fully resolve your issue. Would you like me to connect you with a human support agent?',
              });
              this.escalated.set(true);
            }
          }

          this.scrollToBottom();
        },
        error: () => {
          this.appendMessage({
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          });
          this.sending.set(false);
          this.scrollToBottom();
        },
      });
  }

  sendQuickAction(action: { label: string; message: string }): void {
    this.messageText = action.message;
    this.sendMessage();
  }

  resetChat(): void {
    this.messages.set([]);
    this.escalated.set(false);
    this.unresolved = 0;
    this.sessionId = this.generateSessionId();
  }

  private appendMessage(msg: ChatMessage): void {
    this.messages.update((msgs) => [...msgs, msg]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
