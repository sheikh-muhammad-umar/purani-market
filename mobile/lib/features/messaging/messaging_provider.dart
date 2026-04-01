import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/services/websocket_service.dart';
import '../../models/conversation.dart';
import '../../models/message.dart';

/// State for the conversation list.
class ConversationsState {
  final List<Conversation> conversations;
  final bool isLoading;
  final String? error;

  const ConversationsState({
    this.conversations = const [],
    this.isLoading = false,
    this.error,
  });

  ConversationsState copyWith({
    List<Conversation>? conversations,
    bool? isLoading,
    String? error,
  }) {
    return ConversationsState(
      conversations: conversations ?? this.conversations,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ConversationsNotifier extends StateNotifier<ConversationsState> {
  final ApiClient _api;

  ConversationsNotifier({required ApiClient api})
      : _api = api,
        super(const ConversationsState());

  Future<void> loadConversations() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/conversations');
      final list = (response.data as List)
          .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
          .toList();
      state = ConversationsState(conversations: list);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void updateLastMessage(String conversationId, String preview, DateTime time) {
    final updated = state.conversations.map((c) {
      if (c.id == conversationId) {
        return Conversation(
          id: c.id,
          productListingId: c.productListingId,
          buyerId: c.buyerId,
          sellerId: c.sellerId,
          lastMessageAt: time,
          lastMessagePreview: preview,
          createdAt: c.createdAt,
        );
      }
      return c;
    }).toList()
      ..sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
    state = state.copyWith(conversations: updated);
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, ConversationsState>((ref) {
  return ConversationsNotifier(api: ref.watch(apiClientProvider));
});

/// State for a single chat window.
class ChatState {
  final List<Message> messages;
  final bool isLoading;
  final bool isSending;
  final String? error;
  final bool isTyping;
  final Map<String, dynamic>? listingInfo;

  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.isSending = false,
    this.error,
    this.isTyping = false,
    this.listingInfo,
  });

  ChatState copyWith({
    List<Message>? messages,
    bool? isLoading,
    bool? isSending,
    String? error,
    bool? isTyping,
    Map<String, dynamic>? listingInfo,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      isSending: isSending ?? this.isSending,
      error: error,
      isTyping: isTyping ?? this.isTyping,
      listingInfo: listingInfo ?? this.listingInfo,
    );
  }
}

class ChatNotifier extends StateNotifier<ChatState> {
  final ApiClient _api;
  final WebSocketService _ws;
  final String conversationId;
  final String currentUserId;
  StreamSubscription<Map<String, dynamic>>? _wsSub;

  ChatNotifier({
    required ApiClient api,
    required WebSocketService ws,
    required this.conversationId,
    required this.currentUserId,
  })  : _api = api,
        _ws = ws,
        super(const ChatState()) {
    _listenToWebSocket();
  }

  void _listenToWebSocket() {
    _wsSub = _ws.messages.listen((data) {
      final event = data['event'] as String?;
      if (data['conversationId'] != conversationId) return;

      if (event == 'message') {
        final msg = Message.fromJson(data['message'] as Map<String, dynamic>);
        state = state.copyWith(messages: [...state.messages, msg]);
        _ws.markRead(conversationId);
      } else if (event == 'typing') {
        state = state.copyWith(isTyping: true);
        Future.delayed(const Duration(seconds: 3), () {
          if (mounted) state = state.copyWith(isTyping: false);
        });
      } else if (event == 'read') {
        final updated = state.messages.map((m) {
          if (m.senderId == currentUserId && !m.isRead) {
            return Message(
              id: m.id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              content: m.content,
              isRead: true,
              createdAt: m.createdAt,
            );
          }
          return m;
        }).toList();
        state = state.copyWith(messages: updated);
      }
    });
  }

  Future<void> loadMessages() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.get('/conversations/$conversationId/messages');
      final msgs = (response.data['messages'] as List? ?? [])
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
      final listing = response.data['listing'] as Map<String, dynamic>?;
      state = ChatState(messages: msgs, listingInfo: listing);
      _ws.markRead(conversationId);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> sendMessage(String content) async {
    state = state.copyWith(isSending: true);
    _ws.send({
      'event': 'message',
      'conversationId': conversationId,
      'content': content,
    });
    state = state.copyWith(isSending: false);
  }

  void sendTypingIndicator() {
    _ws.sendTyping(conversationId);
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    super.dispose();
  }
}

final chatProvider =
    StateNotifierProvider.family<ChatNotifier, ChatState, String>(
  (ref, conversationId) {
    final authState = ref.watch(authProvider);
    return ChatNotifier(
      api: ref.watch(apiClientProvider),
      ws: ref.watch(webSocketServiceProvider),
      conversationId: conversationId,
      currentUserId: authState.user?.id ?? '',
    );
  },
);

/// Quick reply suggestions.
const List<String> quickReplySuggestions = [
  'Is this still available?',
  "What's your best price?",
  'Can I see more photos?',
  'Where can we meet?',
];
