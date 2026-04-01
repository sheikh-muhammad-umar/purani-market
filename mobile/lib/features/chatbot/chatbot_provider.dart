import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';

/// A single chatbot message.
class ChatbotMessage {
  final String content;
  final bool isUser;
  final DateTime timestamp;

  const ChatbotMessage({
    required this.content,
    required this.isUser,
    required this.timestamp,
  });
}

/// State for the chatbot conversation.
class ChatbotState {
  final List<ChatbotMessage> messages;
  final bool isLoading;
  final String? error;
  final int unresolved;

  const ChatbotState({
    this.messages = const [],
    this.isLoading = false,
    this.error,
    this.unresolved = 0,
  });

  ChatbotState copyWith({
    List<ChatbotMessage>? messages,
    bool? isLoading,
    String? error,
    int? unresolved,
  }) {
    return ChatbotState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      unresolved: unresolved ?? this.unresolved,
    );
  }

  bool get shouldEscalate => unresolved >= 3;
}

class ChatbotNotifier extends StateNotifier<ChatbotState> {
  final ApiClient _api;

  ChatbotNotifier({required ApiClient api})
      : _api = api,
        super(const ChatbotState());

  Future<void> sendMessage(String content) async {
    final userMsg = ChatbotMessage(
      content: content,
      isUser: true,
      timestamp: DateTime.now(),
    );
    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isLoading: true,
      error: null,
    );

    try {
      final response = await _api.post('/chatbot/message', data: {
        'message': content,
      });
      final data = response.data as Map<String, dynamic>;
      final reply = data['reply'] as String? ?? 'Sorry, I could not understand.';
      final resolved = data['resolved'] as bool? ?? false;

      final botMsg = ChatbotMessage(
        content: reply,
        isUser: false,
        timestamp: DateTime.now(),
      );
      state = state.copyWith(
        messages: [...state.messages, botMsg],
        isLoading: false,
        unresolved: resolved ? 0 : state.unresolved + 1,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void clearConversation() {
    state = const ChatbotState();
  }
}

final chatbotProvider =
    StateNotifierProvider<ChatbotNotifier, ChatbotState>((ref) {
  return ChatbotNotifier(api: ref.watch(apiClientProvider));
});
