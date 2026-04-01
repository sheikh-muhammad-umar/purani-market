import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/core/auth/auth_provider.dart';
import 'package:marketplace_mobile/features/messaging/messaging_provider.dart';
import 'package:marketplace_mobile/features/messaging/chat_window_screen.dart';
import 'package:marketplace_mobile/models/message.dart';

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
  group('ChatWindowScreen - UI', () {
    testWidgets('renders Chat title in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const ChatWindowScreen(conversationId: 'test-conv-1'),
        overrides: [
          authProvider.overrideWith((ref) {
            return AuthNotifier(
              api: throw UnimplementedError(),
              tokenStorage: throw UnimplementedError(),
            );
          }),
          chatProvider('test-conv-1').overrideWith((ref) {
            return ChatNotifier(
              api: throw UnimplementedError(),
              ws: throw UnimplementedError(),
              conversationId: 'test-conv-1',
              currentUserId: 'user-1',
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Chat'), findsOneWidget);
    });

    testWidgets('renders message input field', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const ChatWindowScreen(conversationId: 'test-conv-1'),
        overrides: [
          authProvider.overrideWith((ref) {
            return AuthNotifier(
              api: throw UnimplementedError(),
              tokenStorage: throw UnimplementedError(),
            );
          }),
          chatProvider('test-conv-1').overrideWith((ref) {
            return ChatNotifier(
              api: throw UnimplementedError(),
              ws: throw UnimplementedError(),
              conversationId: 'test-conv-1',
              currentUserId: 'user-1',
            );
          }),
        ],
      ));
      await tester.pump();

      expect(find.byType(TextField), findsOneWidget);
      expect(find.byIcon(Icons.send), findsOneWidget);
    });
  });

  group('Message model', () {
    test('creates message from JSON', () {
      final json = {
        '_id': 'msg-1',
        'conversationId': 'conv-1',
        'senderId': 'user-1',
        'content': 'Hello!',
        'isRead': false,
        'createdAt': '2024-01-15T10:30:00.000Z',
      };
      final msg = Message.fromJson(json);
      expect(msg.id, 'msg-1');
      expect(msg.content, 'Hello!');
      expect(msg.isRead, isFalse);
    });

    test('message defaults isRead to false', () {
      final msg = Message(
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Test',
        createdAt: DateTime.now(),
      );
      expect(msg.isRead, isFalse);
    });
  });
}
