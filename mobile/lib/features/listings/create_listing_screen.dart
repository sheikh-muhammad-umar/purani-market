import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../models/category.dart';
import '../categories/categories_provider.dart';
import 'available_packages_widget.dart';
import 'create_listing_provider.dart';

/// 5-step listing creation wizard.
class CreateListingScreen extends ConsumerStatefulWidget {
  const CreateListingScreen({super.key});

  @override
  ConsumerState<CreateListingScreen> createState() =>
      _CreateListingScreenState();
}

class _CreateListingScreenState extends ConsumerState<CreateListingScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(createListingProvider.notifier).reset();
      ref.read(categoriesProvider.notifier).loadCategories();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(createListingProvider);

    // Navigate away on completion
    ref.listen(createListingProvider, (prev, next) {
      if (next.isComplete) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Listing posted successfully!')),
        );
        context.pop();
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Listing'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // Step indicator with animated progress bar
          _StepIndicator(
            currentStep: state.currentStep,
            progress: state.progress,
          ),
          Expanded(
            child: _buildStepContent(state),
          ),
        ],
      ),
    );
  }

  Widget _buildStepContent(CreateListingState state) {
    switch (state.currentStep) {
      case WizardStep.category:
        return _CategoryStep();
      case WizardStep.details:
        return _DetailsStep();
      case WizardStep.media:
        return _MediaStep();
      case WizardStep.location:
        return _LocationStep();
      case WizardStep.review:
        return _ReviewStep();
    }
  }
}

/// Animated step indicator with progress bar.
class _StepIndicator extends StatelessWidget {
  final WizardStep currentStep;
  final double progress;

  const _StepIndicator({
    required this.currentStep,
    required this.progress,
  });

  @override
  Widget build(BuildContext context) {
    final labels = ['Category', 'Details', 'Media', 'Location', 'Review'];
    final currentIdx = WizardStep.values.indexOf(currentStep);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s2),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          // Animated progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 300),
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                backgroundColor: AppColors.border,
                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                minHeight: 4,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s1),
          // Step labels
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(labels.length, (i) {
              final isActive = i == currentIdx;
              final isDone = i < currentIdx;
              return Column(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDone
                          ? AppColors.primary
                          : isActive
                              ? AppColors.primary
                              : AppColors.border,
                    ),
                    child: Center(
                      child: isDone
                          ? const Icon(Icons.check, size: 14, color: Colors.white)
                          : Text(
                              '${i + 1}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isActive ? Colors.white : AppColors.textMuted,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    labels[i],
                    style: TextStyle(
                      fontSize: AppTypography.textXs,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      color: isActive ? AppColors.primary : AppColors.textMuted,
                    ),
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}

/// Step 1: Category selection.
class _CategoryStep extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catState = ref.watch(categoriesProvider);
    final notifier = ref.read(createListingProvider.notifier);

    if (catState.isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    final categories = catState.rootCategories;

    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.s2),
      itemCount: categories.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.s1),
      itemBuilder: (context, index) {
        final cat = categories[index];
        return ListTile(
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: const Icon(Icons.category, color: AppColors.primary),
          ),
          title: Text(cat.name),
          trailing: const Icon(Icons.chevron_right),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          tileColor: AppColors.card,
          onTap: () {
            notifier.updateDraft(
              ref.read(createListingProvider).draft.copyWith(
                    categoryId: cat.id,
                    categoryName: cat.name,
                    categoryPath: [cat.id],
                    categoryAttributes: cat.attributes,
                  ),
            );
            notifier.nextStep();
          },
        );
      },
    );
  }
}

/// Step 2: Details with dynamic category attributes.
class _DetailsStep extends ConsumerStatefulWidget {
  @override
  ConsumerState<_DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends ConsumerState<_DetailsStep> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _priceController = TextEditingController();
  String? _condition;
  final Map<String, dynamic> _attrValues = {};

  @override
  void initState() {
    super.initState();
    final draft = ref.read(createListingProvider).draft;
    _titleController.text = draft.title;
    _descController.text = draft.description;
    _priceController.text = draft.price?.toStringAsFixed(0) ?? '';
    _condition = draft.condition;
    _attrValues.addAll(draft.attributeValues);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(createListingProvider);
    final notifier = ref.read(createListingProvider.notifier);
    final attributes = state.draft.categoryAttributes;

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.s2),
        children: [
          TextFormField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: 'Title'),
            maxLength: 150,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Title is required' : null,
          ),
          const SizedBox(height: AppSpacing.s2),
          TextFormField(
            controller: _descController,
            decoration: const InputDecoration(labelText: 'Description'),
            maxLines: 4,
            maxLength: 5000,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'Description is required' : null,
          ),
          const SizedBox(height: AppSpacing.s2),
          TextFormField(
            controller: _priceController,
            decoration: const InputDecoration(
              labelText: 'Price',
              prefixText: 'Rs ',
            ),
            keyboardType: TextInputType.number,
            validator: (v) {
              if (v == null || v.isEmpty) return 'Price is required';
              if (double.tryParse(v) == null) return 'Invalid price';
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.s2),
          const Text('Condition', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: AppSpacing.s1),
          Wrap(
            spacing: AppSpacing.s1,
            children: ['new', 'used', 'refurbished'].map((c) {
              return ChoiceChip(
                label: Text(c[0].toUpperCase() + c.substring(1)),
                selected: _condition == c,
                selectedColor: AppColors.primary.withOpacity(0.2),
                onSelected: (val) => setState(() => _condition = val ? c : null),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.s2),

          // Dynamic category attributes
          if (attributes.isNotEmpty) ...[
            const Text(
              'Category Details',
              style: TextStyle(
                fontSize: AppTypography.textBase,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.s1),
            ...attributes.map((attr) => _buildAttributeField(attr)),
          ],

          // Available packages for the selected category
          if (state.draft.categoryId != null) ...[
            const SizedBox(height: AppSpacing.s3),
            AvailablePackagesWidget(
              categoryId: state.draft.categoryId!,
              onPackageSelected: (purchaseId) {
                notifier.updateDraft(
                  state.draft.copyWith(
                    purchaseId: purchaseId,
                    clearPurchaseId: purchaseId == null,
                  ),
                );
              },
            ),
          ],

          const SizedBox(height: AppSpacing.s3),
          Row(
            children: [
              OutlinedButton(
                onPressed: () => notifier.previousStep(),
                child: const Text('Back'),
              ),
              const SizedBox(width: AppSpacing.s2),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    if (_formKey.currentState!.validate()) {
                      notifier.updateDraft(
                        state.draft.copyWith(
                          title: _titleController.text,
                          description: _descController.text,
                          price: double.tryParse(_priceController.text),
                          condition: _condition,
                          attributeValues: _attrValues,
                        ),
                      );
                      notifier.nextStep();
                    }
                  },
                  child: const Text('Next'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAttributeField(CategoryAttribute attr) {
    switch (attr.type) {
      case CategoryAttributeType.text:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s2),
          child: TextFormField(
            decoration: InputDecoration(
              labelText: attr.name,
              suffixText: attr.unit,
            ),
            initialValue: _attrValues[attr.key]?.toString(),
            validator: attr.required
                ? (v) => (v == null || v.isEmpty) ? '${attr.name} is required' : null
                : null,
            onChanged: (v) => _attrValues[attr.key] = v,
          ),
        );
      case CategoryAttributeType.number:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s2),
          child: TextFormField(
            decoration: InputDecoration(
              labelText: attr.name,
              suffixText: attr.unit,
            ),
            keyboardType: TextInputType.number,
            initialValue: _attrValues[attr.key]?.toString(),
            validator: attr.required
                ? (v) => (v == null || v.isEmpty) ? '${attr.name} is required' : null
                : null,
            onChanged: (v) => _attrValues[attr.key] = double.tryParse(v),
          ),
        );
      case CategoryAttributeType.select:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s2),
          child: DropdownButtonFormField<String>(
            decoration: InputDecoration(labelText: attr.name),
            value: _attrValues[attr.key] as String?,
            items: (attr.options ?? [])
                .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                .toList(),
            validator: attr.required
                ? (v) => v == null ? '${attr.name} is required' : null
                : null,
            onChanged: (v) => setState(() => _attrValues[attr.key] = v),
          ),
        );
      case CategoryAttributeType.multiselect:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(attr.name, style: const TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: AppSpacing.half),
              Wrap(
                spacing: AppSpacing.s1,
                children: (attr.options ?? []).map((o) {
                  final selected = (_attrValues[attr.key] as List?)?.contains(o) ?? false;
                  return FilterChip(
                    label: Text(o),
                    selected: selected,
                    selectedColor: AppColors.primary.withOpacity(0.2),
                    onSelected: (val) {
                      setState(() {
                        final list = List<String>.from(
                          _attrValues[attr.key] as List? ?? [],
                        );
                        val ? list.add(o) : list.remove(o);
                        _attrValues[attr.key] = list;
                      });
                    },
                  );
                }).toList(),
              ),
            ],
          ),
        );
      case CategoryAttributeType.boolean:
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s2),
          child: SwitchListTile(
            title: Text(attr.name),
            value: _attrValues[attr.key] == true,
            onChanged: (v) => setState(() => _attrValues[attr.key] = v),
            activeColor: AppColors.primary,
            contentPadding: EdgeInsets.zero,
          ),
        );
    }
  }
}

/// Step 3: Media upload (camera/gallery, min 2, max 20 images + 1 video).
class _MediaStep extends ConsumerStatefulWidget {
  @override
  ConsumerState<_MediaStep> createState() => _MediaStepState();
}

class _MediaStepState extends ConsumerState<_MediaStep> {
  final _picker = ImagePicker();

  Future<void> _pickImages() async {
    final images = await _picker.pickMultiImage();
    if (images.isNotEmpty) {
      final state = ref.read(createListingProvider);
      final current = List<File>.from(state.draft.imageFiles);
      for (final img in images) {
        if (current.length >= 20) break;
        current.add(File(img.path));
      }
      ref.read(createListingProvider.notifier).updateDraft(
            state.draft.copyWith(imageFiles: current),
          );
    }
  }

  Future<void> _takePhoto() async {
    final image = await _picker.pickImage(source: ImageSource.camera);
    if (image != null) {
      final state = ref.read(createListingProvider);
      final current = List<File>.from(state.draft.imageFiles);
      if (current.length < 20) {
        current.add(File(image.path));
        ref.read(createListingProvider.notifier).updateDraft(
              state.draft.copyWith(imageFiles: current),
            );
      }
    }
  }

  Future<void> _pickVideo() async {
    final video = await _picker.pickVideo(source: ImageSource.gallery);
    if (video != null) {
      ref.read(createListingProvider.notifier).updateDraft(
            ref.read(createListingProvider).draft.copyWith(
                  videoFile: File(video.path),
                ),
          );
    }
  }

  void _removeImage(int index) {
    final state = ref.read(createListingProvider);
    final current = List<File>.from(state.draft.imageFiles)..removeAt(index);
    ref.read(createListingProvider.notifier).updateDraft(
          state.draft.copyWith(imageFiles: current),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(createListingProvider);
    final notifier = ref.read(createListingProvider.notifier);
    final draft = state.draft;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s2),
      children: [
        Text(
          'Photos (${draft.imageFiles.length}/20)',
          style: const TextStyle(
            fontSize: AppTypography.textBase,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Minimum 2 photos required',
          style: TextStyle(
            fontSize: AppTypography.textSm,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.s2),

        // Image grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: AppSpacing.s1,
            crossAxisSpacing: AppSpacing.s1,
          ),
          itemCount: draft.imageFiles.length + 1,
          itemBuilder: (context, index) {
            if (index == draft.imageFiles.length) {
              // Add button
              return GestureDetector(
                onTap: () => _showImageSourceSheet(context),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    border: Border.all(
                      color: AppColors.border,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo, color: AppColors.primary),
                      SizedBox(height: 4),
                      Text(
                        'Add',
                        style: TextStyle(
                          fontSize: AppTypography.textXs,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }
            return Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  child: Image.file(
                    draft.imageFiles[index],
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: double.infinity,
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: GestureDetector(
                    onTap: () => _removeImage(index),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                if (index == 0)
                  Positioned(
                    bottom: 4,
                    left: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Cover',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),

        const SizedBox(height: AppSpacing.s3),

        // Video section
        Text(
          'Video (${draft.videoFile != null ? 1 : 0}/1)',
          style: const TextStyle(
            fontSize: AppTypography.textBase,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.s1),
        if (draft.videoFile != null)
          ListTile(
            leading: const Icon(Icons.videocam, color: AppColors.primary),
            title: Text(draft.videoFile!.path.split('/').last),
            trailing: IconButton(
              icon: const Icon(Icons.delete, color: AppColors.error),
              onPressed: () => notifier.updateDraft(
                draft.copyWith(clearVideo: true),
              ),
            ),
            tileColor: AppColors.background,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
          )
        else
          OutlinedButton.icon(
            onPressed: _pickVideo,
            icon: const Icon(Icons.videocam),
            label: const Text('Add Video'),
          ),

        const SizedBox(height: AppSpacing.s3),
        Row(
          children: [
            OutlinedButton(
              onPressed: () => notifier.previousStep(),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: ElevatedButton(
                onPressed: draft.imageFiles.length >= 2
                    ? () => notifier.nextStep()
                    : null,
                child: const Text('Next'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _showImageSourceSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppSpacing.radiusLg),
        ),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(ctx);
                _takePhoto();
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImages();
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Step 4: Location (map picker).
class _LocationStep extends ConsumerStatefulWidget {
  @override
  ConsumerState<_LocationStep> createState() => _LocationStepState();
}

class _LocationStepState extends ConsumerState<_LocationStep> {
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    final draft = ref.read(createListingProvider).draft;
    _cityController.text = draft.city;
    _areaController.text = draft.area;
  }

  @override
  void dispose() {
    _cityController.dispose();
    _areaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(createListingProvider);
    final notifier = ref.read(createListingProvider.notifier);

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.s2),
        children: [
          const Text(
            'Location',
            style: TextStyle(
              fontSize: AppTypography.textLg,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.s2),

          // Map placeholder
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: AppColors.border),
            ),
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.map, size: 48, color: AppColors.textMuted),
                  SizedBox(height: AppSpacing.s1),
                  Text(
                    'Tap to pick location on map',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s2),

          TextFormField(
            controller: _cityController,
            decoration: const InputDecoration(labelText: 'City'),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'City is required' : null,
          ),
          const SizedBox(height: AppSpacing.s2),
          TextFormField(
            controller: _areaController,
            decoration: const InputDecoration(labelText: 'Area'),
          ),
          const SizedBox(height: AppSpacing.s3),
          Row(
            children: [
              OutlinedButton(
                onPressed: () => notifier.previousStep(),
                child: const Text('Back'),
              ),
              const SizedBox(width: AppSpacing.s2),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    if (_formKey.currentState!.validate()) {
                      notifier.updateDraft(
                        state.draft.copyWith(
                          city: _cityController.text,
                          area: _areaController.text,
                        ),
                      );
                      notifier.nextStep();
                    }
                  },
                  child: const Text('Next'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Step 5: Review & Post.
class _ReviewStep extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(createListingProvider);
    final notifier = ref.read(createListingProvider.notifier);
    final draft = state.draft;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s2),
      children: [
        const Text(
          'Review Your Listing',
          style: TextStyle(
            fontSize: AppTypography.textLg,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.s2),

        _ReviewRow(label: 'Category', value: draft.categoryName ?? '-'),
        _ReviewRow(label: 'Title', value: draft.title),
        _ReviewRow(
          label: 'Price',
          value: 'Rs ${draft.price?.toStringAsFixed(0) ?? '-'}',
        ),
        _ReviewRow(
          label: 'Condition',
          value: draft.condition ?? '-',
        ),
        _ReviewRow(
          label: 'Photos',
          value: '${draft.imageFiles.length} photos',
        ),
        _ReviewRow(
          label: 'Video',
          value: draft.videoFile != null ? '1 video' : 'None',
        ),
        _ReviewRow(label: 'City', value: draft.city),
        _ReviewRow(label: 'Area', value: draft.area),
        _ReviewRow(
          label: 'Package',
          value: draft.purchaseId != null ? 'Applied' : 'None',
        ),

        if (draft.attributeValues.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s2),
          const Text(
            'Category Details',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.s1),
          ...draft.attributeValues.entries.map(
            (e) => _ReviewRow(label: e.key, value: e.value.toString()),
          ),
        ],

        if (state.error != null) ...[
          const SizedBox(height: AppSpacing.s2),
          Text(
            state.error!,
            style: const TextStyle(color: AppColors.error),
          ),
        ],

        const SizedBox(height: AppSpacing.s3),
        Row(
          children: [
            OutlinedButton(
              onPressed: state.isSubmitting
                  ? null
                  : () => notifier.previousStep(),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.s2),
            Expanded(
              child: ElevatedButton(
                onPressed: state.isSubmitting
                    ? null
                    : () => notifier.submitListing(),
                child: state.isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Post Listing'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ReviewRow extends StatelessWidget {
  final String label;
  final String value;

  const _ReviewRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.half),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: AppTypography.textSm,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: AppTypography.textSm,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
