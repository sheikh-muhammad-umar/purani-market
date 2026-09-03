export enum ReportStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ReportTargetType {
  USER = 'user',
  LISTING = 'listing',
}

export enum ReportReason {
  SPAM = 'spam',
  SCAM = 'scam',
  PROHIBITED = 'prohibited',
  OFFENSIVE = 'offensive',
  COUNTERFEIT = 'counterfeit',
  OTHER = 'other',
}

export interface ReportImage {
  url: string;
  key: string;
}

interface ReportUserSummary {
  _id: string;
  email?: string;
  profile?: { firstName?: string; lastName?: string; avatar?: string };
  reportCount?: number;
  status?: string;
}

export interface AdminReport {
  _id: string;
  targetType: ReportTargetType;
  reportedListingId?: string | { _id: string; title?: string; status?: string };
  reason: ReportReason;
  message: string;
  screenshots: ReportImage[];
  status: ReportStatus;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  reporter?: ReportUserSummary;
  reportedUser?: ReportUserSummary;
}

export interface PaginatedReports {
  data: AdminReport[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewReportResult {
  reportCount: number;
  suspended: boolean;
}
