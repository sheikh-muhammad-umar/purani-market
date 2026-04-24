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
  DUPLICATE_IMAGE_DETECTED:
    'Duplicate images are not allowed. Each uploaded image must be unique.',
  NO_FILE_PROVIDED: 'No file provided',
  INVALID_IMAGE_FORMAT: 'Invalid image format. Allowed: JPEG, PNG, WebP',
  IMAGE_SIZE_EXCEEDED: 'Image size exceeds 5MB',
  INVALID_VIDEO_FORMAT: 'Invalid video format. Allowed: MP4',
  VIDEO_SIZE_EXCEEDED: 'Video size exceeds 50MB',
  NOT_AUTHORIZED_UPLOAD: 'Not authorized to upload to this listing',
  INVALID_CATEGORY_ID: 'Invalid category ID',
  INVALID_BRAND_ID: 'Invalid brand ID',
  INVALID_MODEL_ID: 'Invalid model ID',
  LISTING_CANNOT_UPDATE_DELETED: 'Cannot update a deleted listing',
  LISTING_MAX_REJECTIONS:
    'This listing has reached the maximum number of review attempts. Unfortunately, it cannot be resubmitted. You may delete it and create a new listing.',

  // Chat / Messaging
  NO_IMAGE_FILE: 'No image file provided',
  NO_AUDIO_FILE: 'No audio file provided',
  INVALID_CHAT_IMAGE_FORMAT: 'Invalid image format. Allowed: JPEG, PNG, WebP',
  CHAT_IMAGE_SIZE_EXCEEDED: 'Image must be under 10MB',
  INVALID_CHAT_AUDIO_FORMAT:
    'Invalid audio format. Allowed: WebM, OGG, MP4, MP3, WAV, AAC',
  CHAT_VOICE_SIZE_EXCEEDED: 'Voice note must be under 5MB',
  CHAT_VOICE_DURATION_EXCEEDED: 'Voice note must be under 5 minutes',
  CANNOT_MESSAGE_OWN_LISTING:
    'You cannot start a conversation on your own listing',
  NOT_CONVERSATION_PARTICIPANT:
    'You are not a participant in this conversation',
} as const;
