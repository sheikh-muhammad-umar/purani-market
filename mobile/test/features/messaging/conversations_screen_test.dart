import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/messaging/messaging_provider.dart';
import 'package:marketplace_mobile/features/messaging/conversations_screen.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: child),
  );
}

void main() {
  group('ConversationsScreen - UI', () {
    testWidgets('renders Messages title in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const ConversationsScreen(),
        overrides: [
          conversationsProvider.overrideWith((ref) {
            return ConversationsNotifier(api: throw UnimplementedError());
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Messages'), findsOneWidget);
    });

    testWidgets('renders search icon in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const ConversationsScreen(),
        overrides: [
          conversationsProvider.overrideWith((ref) {
            return ConversationsNotifier(api: throw UnimplementedError());
          }),
        ],
      ));
      await tester.pump();

      expect(find.byIcon(Icons.search), findsOneWidget);
    });
  });

  group('ConversationsState', () {
    test('initial state has empty conversations and is not loading', () {
      const state = ConversationsState();
      expect(state.conversations, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('copyWith updates loading state', () {
      const state = ConversationsState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });

    test('copyWith updates error', () {
      const state = ConversationsState();
      final withError = state.copyWith(error: 'Network error');
      expect(withError.error, 'Network error');
    });

    test('copyWith preserves existing values', () {
      const state = ConversationsState(isLoading: true);
      final updated = state.copyWith(error: 'Error');
      expect(updated.isLoading, isTrue);
      expect(updated.error, 'Error');
    });
  });

  group('ChatState', () {
    test('initial state has empty messages', () {
      const state = ChatState();
      expect(state.messages, isEmpty);
      expect(state.isLoading, isFalse);
      expect(state.isSending, isFalse);
      expect(state.isTyping, isFalse);
      expect(state.listingInfo, isNull);
    });

    test('copyWith updates typing state', () {
      const state = ChatState();
      final typing = state.copyWith(isTyping: true);
      expect(typing.isTyping, isTrue);
    });

    test('copyWith updates listing info', () {
      const state = ChatState();
      final withListing = state.copyWith(
        listingInfo: {'title': 'Test Product', 'price': {'amount': 1000}},
      );
      expect(withListing.listingInfo, isNotNull);
      expect(withListing.listingInfo!['title'], 'Test Product');
    });
  });

  group('Quick reply suggestions', () {
    test('has expected suggestions', () {
      expect(quickReplySuggestions, contains('Is this still available?'));
      expect(quickReplySuggestions, contains("What's your best price?"));
      expect(quickReplySuggestions.length, 4);
    });
  });
}
