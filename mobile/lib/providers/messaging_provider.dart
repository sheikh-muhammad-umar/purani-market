import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class MessagingState {
  final List<Conversation> conversations;
  final List<Message> messages;
  final bool isLoading;
  final String? error;

  const MessagingState({
    this.conversations = const [],
    this.messages = const [],
    this.isLoading = false,
    this.error,
  });

  MessagingState copyWith({
    List<Conversation>? conversations,
    List<Message>? messages,
    bool? isLoading,
    String? error,
  }) {
    return MessagingState(
      conversations: conversations ?? this.conversations,
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class MessagingNotifier extends StateNotifier<MessagingState> {
  final ApiClient _api;

  MessagingNotifier(this._api) : super(const MessagingState());

  Future<void> fetchConversations() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/conversations');
      final data = (response.data as List)
          .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(conversations: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> fetchMessages(String conversationId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response =
          await _api.get('/conversations/$conversationId/messages');
      final data = (response.data as List)
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(messages: data, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final messagingProvider =
    StateNotifierProvider<MessagingNotifier, MessagingState>((ref) {
  return MessagingNotifier(ref.watch(apiClientProvider));
});
