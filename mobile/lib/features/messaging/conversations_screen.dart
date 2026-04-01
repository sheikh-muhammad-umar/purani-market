import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'messaging_provider.dart';

/// Conversation list screen — WhatsApp-style list of active chats.
class ConversationsScreen extends ConsumerStatefulWidget {
  const ConversationsScreen({super.key});

  @override
  ConsumerState<ConversationsScreen> createState() =>
      _ConversationsScreenState();
}

class _ConversationsScreenState extends ConsumerState<ConversationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(conversationsProvider.notifier).loadConversations(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
            tooltip: 'Search conversations',
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: AppColors.error),
                      const SizedBox(height: AppSpacing.s1),
                      Text(state.error!,
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: AppSpacing.s2),
                      ElevatedButton(
                        onPressed: () => ref
                            .read(conversationsProvider.notifier)
                            .loadConversations(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : state.conversations.isEmpty
                  ? _buildEmptyState(context)
                  : RefreshIndicator(
                      onRefresh: () => ref
                          .read(conversationsProvider.notifier)
                          .loadConversations(),
                      child: ListView.separated(
                        itemCount: state.conversations.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 72),
                        itemBuilder: (context, index) {
                          final conv = state.conversations[index];
                          return _ConversationTile(
                            conversation: conv,
                            onTap: () => context.push(
                              '/messages/${conv.id}',
                              extra: conv,
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.chat_bubble_outline,
              size: 64, color: AppColors.textMuted.withOpacity(0.5)),
          const SizedBox(height: AppSpacing.s2),
          Text(
            'No conversations yet',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: AppSpacing.s1),
          Text(
            'Start chatting with sellers from listing pages',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final dynamic conversation;
  final VoidCallback onTap;

  const _ConversationTile({
    required this.conversation,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final timeAgo = _formatTimeAgo(conversation.lastMessageAt);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s2,
        vertical: AppSpacing.s1,
      ),
      leading: const CircleAvatar(
        radius: 24,
        backgroundColor: AppColors.primaryLight,
        child: Icon(Icons.person, color: AppColors.primary),
      ),
      title: Text(
        'Conversation',
        style: Theme.of(context).textTheme.titleSmall,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        conversation.lastMessagePreview,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: AppColors.textSecondary),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text(
        timeAgo,
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: AppColors.textMuted),
      ),
      onTap: onTap,
    );
  }

  String _formatTimeAgo(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${dateTime.day}/${dateTime.month}';
  }
}
