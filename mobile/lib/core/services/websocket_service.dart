import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../utils/constants.dart';
import '../api/token_storage.dart';

/// WebSocket service for real-time messaging.
class WebSocketService {
  final TokenStorage _tokenStorage;
  WebSocketChannel? _channel;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  Timer? _reconnectTimer;
  String? _url;
  bool _disposed = false;

  WebSocketService({required TokenStorage tokenStorage})
      : _tokenStorage = tokenStorage;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;
  bool get isConnected => _channel != null;

  /// Connect to the WebSocket server with JWT auth.
  Future<void> connect({String? url}) async {
    _url = url ?? AppConstants.wsBaseUrl;
    final token = await _tokenStorage.getAccessToken();
    final uri = Uri.parse('$_url?token=$token');

    try {
      _channel = WebSocketChannel.connect(uri);
      _channel!.stream.listen(
        (data) {
          try {
            final decoded = jsonDecode(data as String) as Map<String, dynamic>;
            _messageController.add(decoded);
          } catch (_) {
            // Ignore non-JSON messages
          }
        },
        onError: (error) {
          _messageController.addError(error);
          _scheduleReconnect();
        },
        onDone: () {
          _channel = null;
          _scheduleReconnect();
        },
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  /// Send a message through the WebSocket connection.
  void send(Map<String, dynamic> data) {
    _channel?.sink.add(jsonEncode(data));
  }

  /// Send a typing indicator.
  void sendTyping(String conversationId) {
    send({'event': 'typing', 'conversationId': conversationId});
  }

  /// Mark messages as read.
  void markRead(String conversationId) {
    send({'event': 'read', 'conversationId': conversationId});
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!_disposed && _url != null) connect(url: _url);
    });
  }

  /// Disconnect from the WebSocket server.
  void disconnect() {
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    _disposed = true;
    disconnect();
    _messageController.close();
  }
}

final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final service = WebSocketService(tokenStorage: tokenStorage);
  ref.onDispose(() => service.dispose());
  return service;
});
