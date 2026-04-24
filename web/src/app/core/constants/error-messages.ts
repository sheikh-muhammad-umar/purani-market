/** Frontend-facing user error messages */
export const ERROR_MSG = {
  DUPLICATE_IMAGE: 'Duplicate image detected. Each uploaded image must be unique.',
  INVALID_IMAGE_TYPE: 'Only JPEG and PNG images are allowed.',
  FILE_SIZE_EXCEEDED: 'File size must be less than 5MB.',
  VERIFICATION_LOAD_FAILED: 'Failed to load verification status.',
  VERIFICATION_SUBMIT_FAILED: 'Failed to submit verification request.',
  VERIFICATION_APPROVE_FAILED: 'Failed to approve verification.',
  VERIFICATION_REJECT_FAILED: 'Failed to reject verification.',
  VERIFICATIONS_LOAD_FAILED: 'Failed to load verification requests.',
  LISTING_LOAD_FAILED: 'Failed to load listing.',
  LISTING_UPDATE_FAILED: 'Failed to update listing.',
  LISTING_NOT_FOUND: 'Listing not found.',
  LISTING_CREATE_FAILED: 'Failed to create listing. Please try again.',
  PENDING_LISTINGS_LOAD_FAILED: 'Failed to load pending listings. Please try again.',
  INVALID_MAP_LINK: 'Please enter a valid Google Maps or Apple Maps link (https only)',
} as const;
