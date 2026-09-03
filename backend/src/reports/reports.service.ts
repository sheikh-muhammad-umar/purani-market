import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Report,
  ReportDocument,
  ReportStatus,
  ReportTargetType,
  ReportReason,
} from './schemas/report.schema.js';
import {
  User,
  UserDocument,
  UserStatus,
} from '../users/schemas/user.schema.js';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import { StorageService } from '../listings/storage.service.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthService } from '../auth/auth.service.js';
import { EmailService } from '../auth/services/email.service.js';
import { PUBLIC_ERROR } from '../common/constants/public-errors.js';
import {
  MAX_APPROVED_REPORTS,
  REPORT_SUSPENSION_MONTHS,
} from '../common/constants/index.js';
import { containsRegex } from '../common/utils/sanitize-regex.js';

const UPLOAD_FOLDER = 'reports';

export interface CreateReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  message: string;
  reason?: ReportReason;
}

export interface PaginatedReports {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewResult {
  report: ReportDocument;
  reportCount: number;
  suspended: boolean;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    private readonly storageService: StorageService,
    private readonly searchSyncService: SearchSyncService,
    private readonly notificationsService: NotificationsService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  // ── Create ────────────────────────────────────────────────────

  /**
   * File a report against a user or listing, with optional screenshots.
   *
   * The reported user is resolved up front — for a listing report that's the
   * seller — so approval later can credit the right account without a second
   * lookup, and so a report never dangles if the listing is deleted meanwhile.
   */
  async createReport(
    input: CreateReportInput,
    screenshots: Express.Multer.File[] = [],
  ): Promise<ReportDocument> {
    const reporterOid = new Types.ObjectId(input.reporterId);

    const { reportedUserId, reportedListingId } = await this.resolveTarget(
      input.targetType,
      input.targetId,
    );

    // Can't report yourself — a self-report can't lead to a meaningful action
    // and would let a user inflate their own count.
    if (reportedUserId.equals(reporterOid)) {
      throw new BadRequestException(PUBLIC_ERROR.FORBIDDEN);
    }

    // One open report per reporter+target: stops a single user spamming the
    // queue (and the count) with duplicates before an admin has looked.
    const duplicate = await this.reportModel.exists({
      reporterId: reporterOid,
      status: ReportStatus.PENDING,
      ...(reportedListingId
        ? { reportedListingId }
        : { reportedUserId, targetType: ReportTargetType.USER }),
    });
    if (duplicate) {
      throw new BadRequestException(PUBLIC_ERROR.REPORT_ALREADY_PENDING);
    }

    const uploaded = await this.saveScreenshots(screenshots);

    return this.reportModel.create({
      reporterId: reporterOid,
      targetType: input.targetType,
      reportedUserId,
      reportedListingId,
      reason: input.reason ?? ReportReason.OTHER,
      message: input.message,
      screenshots: uploaded,
      status: ReportStatus.PENDING,
    });
  }

  /** Resolve the reported user (and listing, if any) from the target. */
  private async resolveTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<{
    reportedUserId: Types.ObjectId;
    reportedListingId?: Types.ObjectId;
  }> {
    if (targetType === ReportTargetType.LISTING) {
      const listing = await this.listingModel
        .findById(targetId)
        .select('_id sellerId')
        .lean()
        .exec();
      if (!listing) {
        throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
      }
      return {
        reportedUserId: new Types.ObjectId(listing.sellerId),
        reportedListingId: new Types.ObjectId(listing._id),
      };
    }

    const user = await this.userModel
      .findById(targetId)
      .select('_id')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return { reportedUserId: new Types.ObjectId(user._id) };
  }

  private async saveScreenshots(
    files: Express.Multer.File[],
  ): Promise<Array<{ url: string; key: string }>> {
    if (!files.length) return [];
    const results = await Promise.all(
      files.map((f) =>
        this.storageService.saveFile(UPLOAD_FOLDER, f.originalname, f.buffer),
      ),
    );
    return results.map((r) => ({ url: r.fileUrl, key: r.key }));
  }

  // ── Admin: list & detail ──────────────────────────────────────

  async getAllReports(params: {
    page?: number;
    limit?: number;
    status?: string;
    targetType?: string;
    search?: string;
  }): Promise<PaginatedReports> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const match: Record<string, any> = {};
    if (params.status) match.status = params.status;
    if (params.targetType) match.targetType = params.targetType;
    if (params.search) match.message = containsRegex(params.search);

    // Join reporter + reported user so the queue can show who reported whom
    // without N+1 lookups on the client.
    const lookups: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'reporterId',
          foreignField: '_id',
          as: 'reporter',
        },
      },
      { $unwind: { path: '$reporter', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'reportedUserId',
          foreignField: '_id',
          as: 'reportedUser',
        },
      },
      { $unwind: { path: '$reportedUser', preserveNullAndEmptyArrays: true } },
    ];

    const dataPipeline: PipelineStage[] = [
      ...lookups,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          targetType: 1,
          reportedListingId: 1,
          reason: 1,
          message: 1,
          screenshots: 1,
          status: 1,
          reviewNote: 1,
          reviewedAt: 1,
          createdAt: 1,
          'reporter._id': 1,
          'reporter.email': 1,
          'reporter.profile': 1,
          'reportedUser._id': 1,
          'reportedUser.email': 1,
          'reportedUser.profile': 1,
          'reportedUser.reportCount': 1,
          'reportedUser.status': 1,
        },
      },
    ];

    const [countResult, data] = await Promise.all([
      this.reportModel.aggregate([...lookups, { $count: 'total' }]).exec(),
      this.reportModel.aggregate(dataPipeline).exec(),
    ]);

    return {
      data,
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    };
  }

  async getReportById(id: string): Promise<ReportDocument> {
    const report = await this.reportModel
      .findById(id)
      .populate('reporterId', 'email profile')
      .populate('reportedUserId', 'email profile reportCount status')
      .populate('reportedListingId', 'title status')
      .lean()
      .exec();
    if (!report) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    return report as unknown as ReportDocument;
  }

  // ── Admin: review ─────────────────────────────────────────────

  /**
   * Approve or reject a report.
   *
   * Approval is the only path that changes anything about the reported user:
   * it increments their upheld-report count and, once that count exceeds the
   * threshold, suspends the account for the configured period. Notifications
   * and emails are best-effort — the review decision is the record of truth and
   * must not fail because a push or SMTP call did.
   */
  async reviewReport(
    reportId: string,
    adminId: string,
    status: ReportStatus,
    reviewNote?: string,
  ): Promise<ReviewResult> {
    if (status === ReportStatus.PENDING) {
      throw new BadRequestException(PUBLIC_ERROR.BAD_REQUEST);
    }

    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException(PUBLIC_ERROR.NOT_FOUND);
    }
    // Idempotency: a report is reviewed once. Re-approving would double-count.
    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException(PUBLIC_ERROR.REPORT_ALREADY_REVIEWED);
    }

    report.status = status;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewedAt = new Date();
    if (reviewNote) report.reviewNote = reviewNote;
    await report.save();

    if (status === ReportStatus.REJECTED) {
      return { report, reportCount: 0, suspended: false };
    }

    // ── Approved: credit the reported user and maybe suspend ──
    const reportedUserId = report.reportedUserId.toString();
    const updated = await this.userModel
      .findByIdAndUpdate(
        report.reportedUserId,
        { $inc: { reportCount: 1 } },
        { new: true },
      )
      .exec();

    const reportCount = updated?.reportCount ?? 0;
    let suspended = false;

    // 3 upheld reports → suspend. Guard on current status so a user already
    // serving a suspension isn't re-suspended (and re-notified) on each new
    // approval during the ban.
    if (
      updated &&
      reportCount >= MAX_APPROVED_REPORTS &&
      updated.status !== UserStatus.SUSPENDED
    ) {
      await this.suspendUser(reportedUserId, reviewNote);
      suspended = true;
    }

    // Notify the reported user of the upheld report (independent of suspension).
    this.notifyApproval(reportedUserId, reviewNote).catch((err) =>
      this.logger.warn(
        `Failed to notify report approval for ${reportedUserId}: ${(err as Error).message}`,
      ),
    );

    return { report, reportCount, suspended };
  }

  /**
   * Suspend a user for the configured number of months: flip status, record the
   * window and reason, kill sessions, and take down their live listings. Mirrors
   * the admin manual-suspension flow so behaviour is identical however a
   * suspension is triggered.
   */
  private async suspendUser(userId: string, reason?: string): Promise<void> {
    const until = new Date();
    until.setMonth(until.getMonth() + REPORT_SUSPENSION_MONTHS);
    const suspensionReason =
      reason ??
      `Automatically suspended after reaching ${MAX_APPROVED_REPORTS} upheld reports.`;

    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: {
          status: UserStatus.SUSPENDED,
          suspendedUntil: until,
          suspensionReason,
        },
      })
      .exec();

    // Sign the user out everywhere so the ban takes effect immediately, not
    // only on their next login.
    await this.authService
      .invalidateAllSessions(userId)
      .catch((err) =>
        this.logger.warn(
          `Failed to invalidate sessions for ${userId}: ${(err as Error).message}`,
        ),
      );

    await this.deactivateSellerListings(userId);

    // Notify + email the suspension. Best-effort.
    this.notifySuspension(userId, until, suspensionReason).catch((err) =>
      this.logger.warn(
        `Failed to notify suspension for ${userId}: ${(err as Error).message}`,
      ),
    );
  }

  /** Deactivate + unfeature all active listings and pull them from search. */
  private async deactivateSellerListings(userId: string): Promise<void> {
    const sellerOid = new Types.ObjectId(userId);
    const activeListings = await this.listingModel
      .find({ sellerId: sellerOid, status: ListingStatus.ACTIVE })
      .select('_id')
      .lean()
      .exec();

    if (activeListings.length === 0) return;

    await this.listingModel
      .updateMany(
        { sellerId: sellerOid, status: ListingStatus.ACTIVE },
        {
          $set: {
            status: ListingStatus.INACTIVE,
            deactivatedAt: new Date(),
            isFeatured: false,
            updatedAt: new Date(),
          },
          $unset: { featuredUntil: '' },
        },
      )
      .exec();

    for (const listing of activeListings) {
      this.searchSyncService
        .removeListing(listing._id.toString())
        .catch(() => undefined);
    }

    await this.userModel
      .updateOne(
        { _id: sellerOid },
        { $inc: { activeListingCount: -activeListings.length } },
      )
      .exec();
  }

  private async notifyApproval(userId: string, reason?: string): Promise<void> {
    await this.notificationsService.sendReportApprovedNotification(
      userId,
      reason,
    );
    const email = await this.getUserEmail(userId);
    if (email) await this.emailService.sendReportApprovedEmail(email, reason);
  }

  private async notifySuspension(
    userId: string,
    until: Date,
    reason?: string,
  ): Promise<void> {
    await this.notificationsService.sendAccountSuspendedUntilNotification(
      userId,
      until,
      reason,
    );
    const email = await this.getUserEmail(userId);
    if (email) {
      await this.emailService.sendAccountSuspendedEmail(email, until, reason);
    }
  }

  private async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await this.userModel
      .findById(userId)
      .select('email')
      .lean()
      .exec();
    return user?.email ?? undefined;
  }
}
