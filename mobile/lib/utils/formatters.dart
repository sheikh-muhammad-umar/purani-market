import 'package:intl/intl.dart';

/// Price formatting utility.
String formatPrice(double amount, {String currency = 'PKR'}) {
  final formatter = NumberFormat('#,##0', 'en_US');
  return '$currency ${formatter.format(amount)}';
}

/// Date formatting utility.
String formatDate(DateTime date) {
  return DateFormat('MMM d, yyyy').format(date);
}

/// Relative time formatting (e.g., "2 hours ago").
String formatRelativeTime(DateTime date) {
  final now = DateTime.now();
  final diff = now.difference(date);

  if (diff.inDays > 30) return formatDate(date);
  if (diff.inDays > 0) return '${diff.inDays}d ago';
  if (diff.inHours > 0) return '${diff.inHours}h ago';
  if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
  return 'Just now';
}

/// Truncate text with ellipsis.
String truncateText(String text, int maxLength) {
  if (text.length <= maxLength) return text;
  return '${text.substring(0, maxLength)}...';
}
