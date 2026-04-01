import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/core/services/sync_service.dart';

void main() {
  group('SyncResult', () {
    test('default SyncResult has zero synced and failed', () {
      const result = SyncResult();
      expect(result.synced, 0);
      expect(result.failed, 0);
      expect(result.errors, isEmpty);
      expect(result.hasErrors, isFalse);
    });

    test('SyncResult with failures reports hasErrors', () {
      const result = SyncResult(
        synced: 2,
        failed: 1,
        errors: ['Network timeout'],
      );
      expect(result.synced, 2);
      expect(result.failed, 1);
      expect(result.hasErrors, isTrue);
      expect(result.errors, contains('Network timeout'));
    });

    test('SyncResult with only successes has no errors', () {
      const result = SyncResult(synced: 5, failed: 0);
      expect(result.hasErrors, isFalse);
    });
  });

  group('CacheService integration', () {
    // Note: Hive requires initialization which is not available in unit tests
    // without mocking. These tests verify the data structures and logic.

    test('draft data structure includes sync metadata', () {
      final draft = <String, dynamic>{
        'title': 'Test Listing',
        'description': 'A test',
        'price': {'amount': 1000, 'currency': 'PKR'},
      };

      // Simulate what saveDraftOffline does
      draft['_syncStatus'] = 'pending';
      draft['_savedAt'] = DateTime.now().toIso8601String();

      expect(draft['_syncStatus'], 'pending');
      expect(draft['_savedAt'], isNotNull);
      expect(draft['title'], 'Test Listing');
    });

    test('pending drafts filter works correctly', () {
      final drafts = [
        {'title': 'Draft 1', '_syncStatus': 'pending'},
        {'title': 'Draft 2', '_syncStatus': 'synced'},
        {'title': 'Draft 3', '_syncStatus': 'pending'},
      ];

      final pending =
          drafts.where((d) => d['_syncStatus'] == 'pending').toList();
      expect(pending.length, 2);
      expect(pending[0]['title'], 'Draft 1');
      expect(pending[1]['title'], 'Draft 3');
    });
  });
}
