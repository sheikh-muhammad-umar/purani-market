import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../models/category.dart';

/// Wizard steps for creating a listing.
enum WizardStep { category, details, media, location, review }

/// Draft listing data accumulated across wizard steps.
class ListingDraft {
  final String? categoryId;
  final String? categoryName;
  final List<String> categoryPath;
  final List<CategoryAttribute> categoryAttributes;
  final String title;
  final String description;
  final double? price;
  final String? condition;
  final Map<String, dynamic> attributeValues;
  final List<File> imageFiles;
  final File? videoFile;
  final double? latitude;
  final double? longitude;
  final String city;
  final String area;

  const ListingDraft({
    this.categoryId,
    this.categoryName,
    this.categoryPath = const [],
    this.categoryAttributes = const [],
    this.title = '',
    this.description = '',
    this.price,
    this.condition,
    this.attributeValues = const {},
    this.imageFiles = const [],
    this.videoFile,
    this.latitude,
    this.longitude,
    this.city = '',
    this.area = '',
  });

  ListingDraft copyWith({
    String? categoryId,
    String? categoryName,
    List<String>? categoryPath,
    List<CategoryAttribute>? categoryAttributes,
    String? title,
    String? description,
    double? price,
    String? condition,
    Map<String, dynamic>? attributeValues,
    List<File>? imageFiles,
    File? videoFile,
    double? latitude,
    double? longitude,
    String? city,
    String? area,
    bool clearVideo = false,
  }) {
    return ListingDraft(
      categoryId: categoryId ?? this.categoryId,
      categoryName: categoryName ?? this.categoryName,
      categoryPath: categoryPath ?? this.categoryPath,
      categoryAttributes: categoryAttributes ?? this.categoryAttributes,
      title: title ?? this.title,
      description: description ?? this.description,
      price: price ?? this.price,
      condition: condition ?? this.condition,
      attributeValues: attributeValues ?? this.attributeValues,
      imageFiles: imageFiles ?? this.imageFiles,
      videoFile: clearVideo ? null : (videoFile ?? this.videoFile),
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      city: city ?? this.city,
      area: area ?? this.area,
    );
  }
}

class CreateListingState {
  final WizardStep currentStep;
  final ListingDraft draft;
  final bool isSubmitting;
  final String? error;
  final bool isComplete;

  const CreateListingState({
    this.currentStep = WizardStep.category,
    this.draft = const ListingDraft(),
    this.isSubmitting = false,
    this.error,
    this.isComplete = false,
  });

  CreateListingState copyWith({
    WizardStep? currentStep,
    ListingDraft? draft,
    bool? isSubmitting,
    String? error,
    bool? isComplete,
  }) {
    return CreateListingState(
      currentStep: currentStep ?? this.currentStep,
      draft: draft ?? this.draft,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: error,
      isComplete: isComplete ?? this.isComplete,
    );
  }

  double get progress {
    const steps = WizardStep.values;
    return (steps.indexOf(currentStep) + 1) / steps.length;
  }
}

class CreateListingNotifier extends StateNotifier<CreateListingState> {
  final ApiClient _api;

  CreateListingNotifier({required ApiClient api})
      : _api = api,
        super(const CreateListingState());

  void updateDraft(ListingDraft draft) {
    state = state.copyWith(draft: draft);
  }

  void nextStep() {
    final steps = WizardStep.values;
    final idx = steps.indexOf(state.currentStep);
    if (idx < steps.length - 1) {
      state = state.copyWith(currentStep: steps[idx + 1]);
    }
  }

  void previousStep() {
    final steps = WizardStep.values;
    final idx = steps.indexOf(state.currentStep);
    if (idx > 0) {
      state = state.copyWith(currentStep: steps[idx - 1]);
    }
  }

  void goToStep(WizardStep step) {
    state = state.copyWith(currentStep: step);
  }

  Future<void> submitListing() async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      final draft = state.draft;
      final data = {
        'title': draft.title,
        'description': draft.description,
        'price': {'amount': draft.price, 'currency': 'PKR'},
        'categoryId': draft.categoryId,
        'categoryPath': draft.categoryPath,
        'condition': draft.condition,
        'categoryAttributes': draft.attributeValues,
        'location': {
          'type': 'Point',
          'coordinates': [draft.longitude, draft.latitude],
          'city': draft.city,
          'area': draft.area,
        },
      };

      final response = await _api.post('/listings', data: data);
      final listingId = (response.data as Map<String, dynamic>)['_id'];

      // Upload images
      for (final image in draft.imageFiles) {
        await _api.post('/listings/$listingId/media', data: {
          'type': 'image',
          'filename': image.path.split('/').last,
        });
      }

      // Upload video if present
      if (draft.videoFile != null) {
        await _api.post('/listings/$listingId/media', data: {
          'type': 'video',
          'filename': draft.videoFile!.path.split('/').last,
        });
      }

      state = state.copyWith(isSubmitting: false, isComplete: true);
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
    }
  }

  void reset() {
    state = const CreateListingState();
  }
}

final createListingProvider =
    StateNotifierProvider<CreateListingNotifier, CreateListingState>((ref) {
  return CreateListingNotifier(api: ref.watch(apiClientProvider));
});
