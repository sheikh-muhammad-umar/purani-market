import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marketplace_mobile/features/listings/create_listing_provider.dart';
import 'package:marketplace_mobile/features/listings/create_listing_screen.dart';
import 'package:marketplace_mobile/features/categories/categories_provider.dart';
import 'package:marketplace_mobile/models/category.dart';

Widget createTestWidget({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: child),
  );
}

final _testCategories = [
  Category(
    id: 'cat1',
    name: 'Vehicles',
    slug: 'vehicles',
    level: 1,
    attributes: [
      const CategoryAttribute(
        name: 'Mileage',
        key: 'mileage',
        type: CategoryAttributeType.number,
        unit: 'km',
        required: true,
      ),
      const CategoryAttribute(
        name: 'Fuel Type',
        key: 'fuel_type',
        type: CategoryAttributeType.select,
        options: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
        required: true,
      ),
      const CategoryAttribute(
        name: 'Automatic',
        key: 'automatic',
        type: CategoryAttributeType.boolean,
      ),
    ],
    filters: [],
    children: [],
    createdAt: DateTime(2024),
    updatedAt: DateTime(2024),
  ),
  Category(
    id: 'cat2',
    name: 'Electronics',
    slug: 'electronics',
    level: 1,
    attributes: [],
    filters: [],
    children: [],
    createdAt: DateTime(2024),
    updatedAt: DateTime(2024),
  ),
];

void main() {
  group('CreateListingScreen - Wizard Step Navigation', () {
    testWidgets('renders step indicator with Category as first step',
        (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const CreateListingScreen(),
        overrides: [
          categoriesProvider.overrideWith((ref) {
            final notifier = CategoriesNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      // Step indicator should show all 5 steps
      expect(find.text('Category'), findsOneWidget);
      expect(find.text('Details'), findsOneWidget);
      expect(find.text('Media'), findsOneWidget);
      expect(find.text('Location'), findsOneWidget);
      expect(find.text('Review'), findsOneWidget);
    });

    testWidgets('shows Create Listing title in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const CreateListingScreen(),
        overrides: [
          categoriesProvider.overrideWith((ref) {
            final notifier = CategoriesNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('Create Listing'), findsOneWidget);
    });

    testWidgets('shows close button in app bar', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const CreateListingScreen(),
        overrides: [
          categoriesProvider.overrideWith((ref) {
            final notifier = CategoriesNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.byIcon(Icons.close), findsOneWidget);
    });
  });

  group('CreateListingScreen - Step Indicator', () {
    testWidgets('displays step numbers 1 through 5', (tester) async {
      await tester.pumpWidget(createTestWidget(
        child: const CreateListingScreen(),
        overrides: [
          categoriesProvider.overrideWith((ref) {
            final notifier = CategoriesNotifier(
              api: throw UnimplementedError(),
            );
            return notifier;
          }),
        ],
      ));
      await tester.pump();

      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
    });
  });

  group('CreateListingProvider - Wizard Navigation', () {
    test('initial step is category', () {
      const state = CreateListingState();
      expect(state.currentStep, WizardStep.category);
    });

    test('progress is 0.2 at category step', () {
      const state = CreateListingState(currentStep: WizardStep.category);
      expect(state.progress, closeTo(0.2, 0.01));
    });

    test('progress is 0.4 at details step', () {
      const state = CreateListingState(currentStep: WizardStep.details);
      expect(state.progress, closeTo(0.4, 0.01));
    });

    test('progress is 0.6 at media step', () {
      const state = CreateListingState(currentStep: WizardStep.media);
      expect(state.progress, closeTo(0.6, 0.01));
    });

    test('progress is 0.8 at location step', () {
      const state = CreateListingState(currentStep: WizardStep.location);
      expect(state.progress, closeTo(0.8, 0.01));
    });

    test('progress is 1.0 at review step', () {
      const state = CreateListingState(currentStep: WizardStep.review);
      expect(state.progress, closeTo(1.0, 0.01));
    });
  });

  group('Dynamic Attribute Rendering', () {
    test('CategoryAttribute text type creates correct model', () {
      const attr = CategoryAttribute(
        name: 'Brand',
        key: 'brand',
        type: CategoryAttributeType.text,
        required: true,
      );
      expect(attr.type, CategoryAttributeType.text);
      expect(attr.required, isTrue);
      expect(attr.name, 'Brand');
    });

    test('CategoryAttribute number type with unit', () {
      const attr = CategoryAttribute(
        name: 'Mileage',
        key: 'mileage',
        type: CategoryAttributeType.number,
        unit: 'km',
        required: true,
      );
      expect(attr.type, CategoryAttributeType.number);
      expect(attr.unit, 'km');
    });

    test('CategoryAttribute select type with options', () {
      const attr = CategoryAttribute(
        name: 'Fuel Type',
        key: 'fuel_type',
        type: CategoryAttributeType.select,
        options: ['Petrol', 'Diesel', 'Electric'],
        required: true,
      );
      expect(attr.type, CategoryAttributeType.select);
      expect(attr.options, hasLength(3));
      expect(attr.options, contains('Petrol'));
    });

    test('CategoryAttribute boolean type', () {
      const attr = CategoryAttribute(
        name: 'Automatic',
        key: 'automatic',
        type: CategoryAttributeType.boolean,
      );
      expect(attr.type, CategoryAttributeType.boolean);
      expect(attr.required, isFalse);
    });

    test('CategoryAttribute multiselect type', () {
      const attr = CategoryAttribute(
        name: 'Features',
        key: 'features',
        type: CategoryAttributeType.multiselect,
        options: ['AC', 'Power Steering', 'Airbags'],
      );
      expect(attr.type, CategoryAttributeType.multiselect);
      expect(attr.options, hasLength(3));
    });
  });

  group('ListingDraft', () {
    test('default draft has empty values', () {
      const draft = ListingDraft();
      expect(draft.categoryId, isNull);
      expect(draft.title, isEmpty);
      expect(draft.description, isEmpty);
      expect(draft.price, isNull);
      expect(draft.imageFiles, isEmpty);
      expect(draft.videoFile, isNull);
    });

    test('copyWith updates specified fields', () {
      const draft = ListingDraft();
      final updated = draft.copyWith(
        title: 'Test Car',
        price: 500000,
        condition: 'used',
      );
      expect(updated.title, 'Test Car');
      expect(updated.price, 500000);
      expect(updated.condition, 'used');
      expect(updated.categoryId, isNull); // unchanged
    });

    test('copyWith clearVideo removes video', () {
      const draft = ListingDraft();
      final withVideo = draft.copyWith(title: 'Test');
      final cleared = withVideo.copyWith(clearVideo: true);
      expect(cleared.videoFile, isNull);
    });
  });
}
