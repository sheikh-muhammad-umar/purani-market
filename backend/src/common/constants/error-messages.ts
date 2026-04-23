/** Centralized error messages */

export const ERROR = {
  USER_NOT_FOUND: 'User not found',
  LISTING_NOT_FOUND: 'Listing not found',
  BRAND_NOT_FOUND: 'Brand not found',
  VEHICLE_BRAND_NOT_FOUND: 'Vehicle brand not found',
  VEHICLE_MODEL_NOT_FOUND: 'Vehicle model not found',
  VEHICLE_VARIANT_NOT_FOUND: 'Vehicle variant not found',
  CATEGORY_NOT_FOUND: 'Category not found',
  SELLER_NOT_FOUND: 'Seller not found',
  PACKAGE_NOT_FOUND: 'Package not found',
  FAVORITE_NOT_FOUND: 'Favorite not found',
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  REJECTION_REASON_NOT_FOUND: 'Rejection reason not found',
  DELETION_REASON_NOT_FOUND: 'Deletion reason not found',
  VERIFICATION_NOT_FOUND: 'Verification request not found',
  VERIFICATION_ALREADY_PENDING:
    'You already have a pending verification request. Please wait for it to be reviewed.',
  VERIFICATION_ALREADY_VERIFIED: 'Your ID is already verified.',
  VERIFICATION_ALREADY_REVIEWED: 'This verification has already been reviewed.',
  VERIFICATION_CANNOT_SET_PENDING: 'Cannot set status back to pending.',
  VERIFICATION_REJECTION_REASON_REQUIRED: 'Rejection reason is required.',
  VERIFICATION_ALL_IMAGES_REQUIRED:
    'All 4 images are required: cnicFront, cnicBack, selfieFront, selfieBack',
  VERIFICATION_INVALID_IMAGE_TYPE: 'Only JPEG and PNG images are allowed',
  INVALID_CATEGORY_ID: 'Invalid category ID',
  INVALID_BRAND_ID: 'Invalid brand ID',
  INVALID_MODEL_ID: 'Invalid model ID',
} as const;
