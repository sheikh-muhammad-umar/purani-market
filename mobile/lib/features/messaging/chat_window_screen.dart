import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'messaging_provider.dart';

/// Chat window screen — WhatsApp-style chat bubbles with read receipts,
/// typing indicators, quick-reply suggestions, and product card header.
class ChatWindowScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const ChatWindowScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ChatWindowScreen> createState() => _ChatWindowScreenState();
}

class _ChatWindowScreenState extends ConsumerState<ChatWindowScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref
          .read(chatProvider(widget.conversationId).notifier)
          .loadMessages(),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    ref
        .read(chatProvider(widget.conversationId).notifier)
        .sendMessage(text);
    _controller.clear();
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider(widget.conversationId));
    final currentUserId = ref.watch(authProvider).user?.id ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chat', style: TextStyle(fontSize: 16)),
            if (chatState.isTyping)
              Text(
                'typing...',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      fontStyle: FontStyle.italic,
                    ),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Product card at top
          if (chatState.listingInfo != null)
            _ProductCardHeader(listing: chatState.listingInfo!),

          // Messages list
          Expanded(
            child: chatState.isLoading
                ? const Center(child: CircularProgressIndicator())
                : chatState.messages.isEmpty
                    ? _buildEmptyChat(context)
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.s2,
                          vertical: AppSpacing.s1,
                        ),
                        itemCount: chatState.messages.length,
                        itemBuilder: (context, index) {
                          final msg = chatState.messages[index];
                          final isMine = msg.senderId == currentUserId;
                          return _ChatBubble(
                            key: ValueKey(msg.id),
                            message: msg,
                            isMine: isMine,
                            showReadReceipt: isMine &&
                                index == chatState.messages.length - 1,
                          );
                        },
                      ),
          ),

          // Typing indicator
          if (chatState.isTyping)
            const Padding(
              padding: EdgeInsets.only(left: AppSpacing.s2, bottom: 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: _TypingIndicator(),
              ),
            ),

          // Quick reply suggestions (show when no messages or few messages)
          if (chatState.messages.length < 3)
            _QuickReplySuggestions(
              onTap: (suggestion) {
                _controller.text = suggestion;
                _sendMessage();
              },
            ),

          // Message input
          _MessageInput(
            controller: _controller,
            onSend: _sendMessage,
            onTyping: () => ref
                .read(chatProvider(widget.conversationId).notifier)
                .sendTypingIndicator(),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyChat(BuildContext context) {
    return Center(
      child: Text(
        'Send a message to start the conversation',
        style: Theme.of(context)
            .textTheme
            .bodyMedium
            ?.copyWith(color: AppColors.textMuted),
      ),
    );
  }
}

/// Product card embedded at the top of the conversation.
class _ProductCardHeader extends StatelessWidget {
  final Map<String, dynamic> listing;

  const _ProductCardHeader({required this.listing});

  @override
  Widget build(BuildContext context) {
    final title = listing['title'] as String? ?? 'Product';
    final price = listing['price'] as Map<String, dynamic>?;
    final amount = price?['amount']?.toString() ?? '';
    final currency = price?['currency'] as String? ?? 'PKR';
    final imageUrl = (listing['images'] as List?)?.isNotEmpty == true
        ? (listing['images'] as List).first['thumbnailUrl'] as String?
        : null;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s1),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: imageUrl != null
                ? Image.network(imageUrl,
                    width: 48, height: 48, fit: BoxFit.cover)
                : Container(
                    width: 48,
                    height: 48,
                    color: AppColors.primaryLight,
                    child:
                        const Icon(Icons.image, color: AppColors.primary, size: 24),
                  ),
          ),
          const SizedBox(width: AppSpacing.s1),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: Theme.of(context).textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text('$currency $amount',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
        ],
      ),
    );
  }
}

/// WhatsApp-style chat bubble with slide-up entrance animation.
class _ChatBubble extends StatefulWidget {
  final dynamic message;
  final bool isMine;
  final bool showReadReceipt;

  const _ChatBubble({
    super.key,
    required this.message,
    required this.isMine,
    this.showReadReceipt = false,
  });

  @override
  State<_ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<_ChatBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(_animController);
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final time =
        '${widget.message.createdAt.hour.toString().padLeft(2, '0')}:${widget.message.createdAt.minute.toString().padLeft(2, '0')}';

    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: Align(
          alignment:
              widget.isMine ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.s1),
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s2,
              vertical: AppSpacing.s1,
            ),
            decoration: BoxDecoration(
              color: widget.isMine
                  ? AppColors.primary
                  : AppColors.surface,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(widget.isMine ? 16 : 4),
                bottomRight: Radius.circular(widget.isMine ? 4 : 16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  widget.message.content,
                  style: TextStyle(
                    color: widget.isMine ? Colors.white : AppColors.textPrimary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      time,
                      style: TextStyle(
                        fontSize: 11,
                        color: widget.isMine
                            ? Colors.white70
                            : AppColors.textMuted,
                      ),
                    ),
                    if (widget.isMine) ...[
                      const SizedBox(width: 4),
                      Icon(
                        widget.message.isRead
                            ? Icons.done_all
                            : Icons.done,
                        size: 14,
                        color: widget.message.isRead
                            ? Colors.lightBlueAccent
                            : Colors.white70,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Animated typing indicator (three bouncing dots).
class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: _BouncingDot(delay: i * 150),
          );
        }),
      ),
    );
  }
}

class _BouncingDot extends StatefulWidget {
  final int delay;
  const _BouncingDot({required this.delay});

  @override
  State<_BouncingDot> createState() => _BouncingDotState();
}

class _BouncingDotState extends State<_BouncingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _controller.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, child) {
        return Transform.translate(
          offset: Offset(0, -4 * _controller.value),
          child: child,
        );
      },
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          color: AppColors.textMuted,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

/// Quick reply suggestion chips.
class _QuickReplySuggestions extends StatelessWidget {
  final void Function(String) onTap;

  const _QuickReplySuggestions({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2),
        itemCount: quickReplySuggestions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final suggestion = quickReplySuggestions[index];
          return ActionChip(
            label: Text(suggestion, style: const TextStyle(fontSize: 12)),
            backgroundColor: AppColors.primaryLight,
            side: BorderSide.none,
            onPressed: () => onTap(suggestion),
          );
        },
      ),
    );
  }
}

/// Message input bar with send button.
class _MessageInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onTyping;

  const _MessageInput({
    required this.controller,
    required this.onSend,
    required this.onTyping,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: AppSpacing.s2,
        right: AppSpacing.s1,
        top: AppSpacing.s1,
        bottom: MediaQuery.of(context).padding.bottom + AppSpacing.s1,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border, width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: (_) => onTyping(),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: 'Type a message...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: Theme.of(context).scaffoldBackgroundColor,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          CircleAvatar(
            backgroundColor: AppColors.primary,
            child: IconButton(
              icon: const Icon(Icons.send, color: Colors.white, size: 20),
              onPressed: onSend,
            ),
          ),
        ],
      ),
    );
  }
}
