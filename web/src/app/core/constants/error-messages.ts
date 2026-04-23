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
} as const;
