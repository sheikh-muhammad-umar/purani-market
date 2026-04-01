import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../storage/cache_service.dart';

/// Sync service that reconciles local changes with the server
/// when connectivity is restored.
class SyncService {
  final ApiClient _api;
  final CacheService _cache;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _isSyncing = false;

  SyncService({
    required ApiClient api,
    required CacheService cache,
    Connectivity? connectivity,
  })  : _api = api,
        _cache = cache,
        _connectivity = connectivity ?? Connectivity();

  /// Start listening for connectivity changes.
  void startListening() {
    _connectivitySub = _connectivity.onConnectivityChanged.listen((results) {
      final hasConnection = results.any((r) => r != ConnectivityResult.none);
      if (hasConnection) {
        syncPendingChanges();
      }
    });
  }

  /// Check if device is currently online.
  Future<bool> get isOnline async {
    final results = await _connectivity.checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  /// Cache listings for offline browsing.
  Future<void> cacheListingsForOffline(
      List<Map<String, dynamic>> listings) async {
    await _cache.cacheListings(listings);
  }

  /// Get cached listings when offline.
  List<Map<String, dynamic>> getOfflineListings() {
    return _cache.getCachedListings();
  }

  /// Get a single cached listing.
  Map<String, dynamic>? getOfflineListing(String id) {
    return _cache.getCachedListing(id);
  }

  /// Save a draft listing offline.
  Future<void> saveDraftOffline(
      String draftId, Map<String, dynamic> draft) async {
    draft['_syncStatus'] = 'pending';
    draft['_savedAt'] = DateTime.now().toIso8601String();
    await _cache.saveDraft(draftId, draft);
  }

  /// Get all pending drafts.
  List<Map<String, dynamic>> getPendingDrafts() {
    return _cache.getDrafts().where((d) {
      return d['_syncStatus'] == 'pending';
    }).toList();
  }

  /// Sync all pending local changes with the server.
  Future<SyncResult> syncPendingChanges() async {
    if (_isSyncing) return const SyncResult();
    _isSyncing = true;

    int synced = 0;
    int failed = 0;
    final errors = <String>[];

    try {
      // Sync pending draft listings
      final drafts = getPendingDrafts();
      for (final draft in drafts) {
        try {
          final draftData = Map<String, dynamic>.from(draft);
          final draftId = draftData.remove('_draftId') as String?;
          draftData.remove('_syncStatus');
          draftData.remove('_savedAt');

          await _api.post('/listings', data: draftData);

          // Remove synced draft
          if (draftId != null) {
            await _cache.deleteDraft(draftId);
          }
          synced++;
        } catch (e) {
          failed++;
          errors.add(e.toString());
        }
      }

      // Refresh cached listings from server
      try {
        final response = await _api.get('/search', queryParameters: {
          'limit': '50',
        });
        final listings = (response.data['results'] as List? ?? [])
            .cast<Map<String, dynamic>>();
        await _cache.cacheListings(listings);
      } catch (_) {
        // Non-critical: cache refresh failure
      }

      // Refresh cached categories
      try {
        final response = await _api.get('/categories');
        final categories =
            (response.data as List).cast<Map<String, dynamic>>();
        await _cache.cacheCategories(categories);
      } catch (_) {
        // Non-critical
      }
    } finally {
      _isSyncing = false;
    }

    return SyncResult(synced: synced, failed: failed, errors: errors);
  }

  /// Stop listening and clean up.
  void dispose() {
    _connectivitySub?.cancel();
  }
}

/// Result of a sync operation.
class SyncResult {
  final int synced;
  final int failed;
  final List<String> errors;

  const SyncResult({
    this.synced = 0,
    this.failed = 0,
    this.errors = const [],
  });

  bool get hasErrors => failed > 0;
}

final syncServiceProvider = Provider<SyncService>((ref) {
  final service = SyncService(
    api: ref.watch(apiClientProvider),
    cache: ref.watch(cacheServiceProvider),
  );
  service.startListening();
  ref.onDispose(() => service.dispose());
  return service;
});
