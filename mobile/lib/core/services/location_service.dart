import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// Location service for geolocation features and proximity-based queries.
class LocationService {
  Position? _lastPosition;

  Position? get lastPosition => _lastPosition;

  /// Check and request location permissions.
  Future<bool> requestPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  /// Get the user's current position.
  Future<Position?> getCurrentPosition() async {
    try {
      final hasPermission = await requestPermission();
      if (!hasPermission) return null;

      _lastPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      );
      return _lastPosition;
    } catch (_) {
      return null;
    }
  }

  /// Calculate distance between two coordinates in kilometers.
  double distanceBetween(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    final distanceInMeters = Geolocator.distanceBetween(
      lat1, lng1, lat2, lng2,
    );
    return distanceInMeters / 1000.0;
  }
}

final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService();
});
