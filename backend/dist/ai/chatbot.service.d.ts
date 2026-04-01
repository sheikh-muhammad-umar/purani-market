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
export declare class ChatbotService {
    private sessions;
    private readonly faqs;
    processMessage(sessionId: string, userMessage: string): Promise<{
        reply: string;
        escalated: boolean;
    }>;
    private findFaqAnswer;
    getSession(sessionId: string): ChatSession | undefined;
    clearSession(sessionId: string): void;
}
