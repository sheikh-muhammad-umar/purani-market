export enum IdVerificationStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface CnicImage {
  url: string;
  key?: string;
}

export interface VerificationUser {
  email?: string;
  phone?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export interface IdVerificationRequest {
  _id: string;
  userId: string;
  user?: VerificationUser;
  cnicFront: CnicImage;
  cnicBack: CnicImage;
  selfieFront: CnicImage;
  selfieBack: CnicImage;
  status: IdVerificationStatus;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IdVerificationMyStatus {
  _id?: string;
  status: IdVerificationStatus;
  cnicFront?: CnicImage;
  cnicBack?: CnicImage;
  selfieFront?: CnicImage;
  selfieBack?: CnicImage;
  rejectionReason?: string;
  createdAt?: string;
  reviewedAt?: string;
}

export interface IdVerificationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  timeSeries: IdVerificationTimeSeriesEntry[];
}

export interface IdVerificationTimeSeriesEntry {
  date: string;
  submitted: number;
  approved: number;
  rejected: number;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
