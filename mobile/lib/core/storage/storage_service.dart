import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Hive-based offline caching service.
class StorageService {
  static const String _listingsBox = 'listings_cache';
  static const String _categoriesBox = 'categories_cache';
  static const String _draftsBox = 'listing_drafts';
  static const String _settingsBox = 'settings';

  /// Open all Hive boxes for offline caching.
  Future<void> initialize() async {
    await Hive.openBox<Map>(_listingsBox);
    await Hive.openBox<Map>(_categoriesBox);
    await Hive.openBox<Map>(_draftsBox);
    await Hive.openBox(_settingsBox);
  }

  // --- Listings cache ---

  Future<void> cacheListings(List<Map<String, dynamic>> listings) async {
    final box = Hive.box<Map>(_listingsBox);
    for (final listing in listings) {
      final id = listing['_id'] as String?;
      if (id != null) {
        await box.put(id, listing);
      }
    }
  }

  List<Map<String, dynamic>> getCachedListings() {
    final box = Hive.box<Map>(_listingsBox);
    return box.values.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Map<String, dynamic>? getCachedListing(String id) {
    final box = Hive.box<Map>(_listingsBox);
    final data = box.get(id);
    return data != null ? Map<String, dynamic>.from(data) : null;
  }

  // --- Categories cache ---

  Future<void> cacheCategories(List<Map<String, dynamic>> categories) async {
    final box = Hive.box<Map>(_categoriesBox);
    await box.clear();
    for (var i = 0; i < categories.length; i++) {
      await box.put(i, categories[i]);
    }
  }

  List<Map<String, dynamic>> getCachedCategories() {
    final box = Hive.box<Map>(_categoriesBox);
    return box.values.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  // --- Listing drafts (offline ad creation) ---

  Future<void> saveDraft(String draftId, Map<String, dynamic> draft) async {
    final box = Hive.box<Map>(_draftsBox);
    await box.put(draftId, draft);
  }

  List<Map<String, dynamic>> getDrafts() {
    final box = Hive.box<Map>(_draftsBox);
    return box.values.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> deleteDraft(String draftId) async {
    final box = Hive.box<Map>(_draftsBox);
    await box.delete(draftId);
  }

  // --- Settings ---

  Future<void> setSetting(String key, dynamic value) async {
    final box = Hive.box(_settingsBox);
    await box.put(key, value);
  }

  T? getSetting<T>(String key) {
    final box = Hive.box(_settingsBox);
    return box.get(key) as T?;
  }

  /// Clear all cached data.
  Future<void> clearAll() async {
    await Hive.box<Map>(_listingsBox).clear();
    await Hive.box<Map>(_categoriesBox).clear();
    await Hive.box<Map>(_draftsBox).clear();
    await Hive.box(_settingsBox).clear();
  }
}

final storageServiceProvider = Provider<StorageService>((ref) {
  return StorageService();
});
