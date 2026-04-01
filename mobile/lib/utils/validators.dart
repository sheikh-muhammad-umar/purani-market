/// Email validation.
String? validateEmail(String? value) {
  if (value == null || value.isEmpty) return 'Email is required';
  final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
  if (!emailRegex.hasMatch(value)) return 'Enter a valid email';
  return null;
}

/// Phone number validation.
String? validatePhone(String? value) {
  if (value == null || value.isEmpty) return 'Phone number is required';
  final phoneRegex = RegExp(r'^\+?[\d\s-]{10,15}$');
  if (!phoneRegex.hasMatch(value)) return 'Enter a valid phone number';
  return null;
}

/// Password validation (min 8 chars).
String? validatePassword(String? value) {
  if (value == null || value.isEmpty) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  return null;
}

/// Required field validation.
String? validateRequired(String? value, {String fieldName = 'This field'}) {
  if (value == null || value.trim().isEmpty) return '$fieldName is required';
  return null;
}

/// Listing title validation (max 150 chars).
String? validateListingTitle(String? value) {
  final required = validateRequired(value, fieldName: 'Title');
  if (required != null) return required;
  if (value!.length > 150) return 'Title must be 150 characters or less';
  return null;
}

/// Listing description validation (max 5000 chars).
String? validateListingDescription(String? value) {
  final required = validateRequired(value, fieldName: 'Description');
  if (required != null) return required;
  if (value!.length > 5000) {
    return 'Description must be 5000 characters or less';
  }
  return null;
}

/// Price validation (positive number).
String? validatePrice(String? value) {
  if (value == null || value.isEmpty) return 'Price is required';
  final price = double.tryParse(value);
  if (price == null || price <= 0) return 'Enter a valid positive price';
  return null;
}
