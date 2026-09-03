import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReportsService } from './reports.service.js';
import {
  Report,
  ReportStatus,
  ReportTargetType,
  ReportReason,
} from './schemas/report.schema.js';
import { User, UserStatus } from '../users/schemas/user.schema.js';
import { ProductListing } from '../listings/schemas/product-listing.schema.js';
import { StorageService } from '../listings/storage.service.js';
import { SearchSyncService } from '../search/search-sync.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuthService } from '../auth/auth.service.js';
import { EmailService } from '../auth/services/email.service.js';

/** Resolves the promise on the microtask queue so best-effort `.catch()`
 * side effects (fired without await) have run before assertions. */
const flush = () => new Promise((r) => setImmediate(r));

describe('ReportsService', () => {
  let service: ReportsService;
  let reportModel: any;
  let userModel: any;
  let listingModel: any;
  let storage: { saveFile: jest.Mock };
  let searchSync: { removeListing: jest.Mock };
  let notifications: {
    sendReportApprovedNotification: jest.Mock;
    sendAccountSuspendedUntilNotification: jest.Mock;
  };
  let auth: { invalidateAllSessions: jest.Mock };
  let email: {
    sendReportApprovedEmail: jest.Mock;
    sendAccountSuspendedEmail: jest.Mock;
  };

  const reporterId = new Types.ObjectId().toString();
  const sellerId = new Types.ObjectId().toString();
  const listingId = new Types.ObjectId().toString();

  /** A pending report document with a save() spy. */
  function makeReportDoc(overrides: Record<string, any> = {}) {
    return {
      _id: new Types.ObjectId(),
      reportedUserId: new Types.ObjectId(sellerId),
      status: ReportStatus.PENDING,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  beforeEach(async () => {
    reportModel = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      exists: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      aggregate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };

    userModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    listingModel = {
      findById: jest.fn(),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      updateMany: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };

    storage = {
      saveFile: jest
        .fn()
        .mockResolvedValue({ fileUrl: 'http://x/y.png', key: 'reports/y.png' }),
    };
    searchSync = { removeListing: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      sendReportApprovedNotification: jest.fn().mockResolvedValue(true),
      sendAccountSuspendedUntilNotification: jest.fn().mockResolvedValue(true),
    };
    auth = { invalidateAllSessions: jest.fn().mockResolvedValue(undefined) };
    email = {
      sendReportApprovedEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountSuspendedEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getModelToken(Report.name), useValue: reportModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(ProductListing.name), useValue: listingModel },
        { provide: StorageService, useValue: storage },
        { provide: SearchSyncService, useValue: searchSync },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuthService, useValue: auth },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  // ── create ──────────────────────────────────────────────────

  describe('createReport', () => {
    it('resolves a listing report to its seller and saves screenshots', async () => {
      listingModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: listingId, sellerId }),
      });

      const file = { originalname: 's.png', buffer: Buffer.from('x') } as any;
      await service.createReport(
        {
          reporterId,
          targetType: ReportTargetType.LISTING,
          targetId: listingId,
          message: 'This listing is a scam',
          reason: ReportReason.SCAM,
        },
        [file],
      );

      expect(storage.saveFile).toHaveBeenCalledTimes(1);
      const created = reportModel.create.mock.calls[0][0];
      expect(created.reportedUserId.toString()).toBe(sellerId);
      expect(created.reportedListingId.toString()).toBe(listingId);
      expect(created.screenshots).toEqual([
        { url: 'http://x/y.png', key: 'reports/y.png' },
      ]);
      expect(created.status).toBe(ReportStatus.PENDING);
    });

    it('rejects a report against a missing listing', async () => {
      listingModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.createReport({
          reporterId,
          targetType: ReportTargetType.LISTING,
          targetId: listingId,
          message: 'x'.repeat(10),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids reporting yourself', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: reporterId }),
      });
      await expect(
        service.createReport({
          reporterId,
          targetType: ReportTargetType.USER,
          targetId: reporterId,
          message: 'x'.repeat(10),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate pending report', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: sellerId }),
      });
      reportModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
      await expect(
        service.createReport({
          reporterId,
          targetType: ReportTargetType.USER,
          targetId: sellerId,
          message: 'x'.repeat(10),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(reportModel.create).not.toHaveBeenCalled();
    });
  });

  // ── review ──────────────────────────────────────────────────

  describe('reviewReport', () => {
    const adminId = new Types.ObjectId().toString();

    it('rejecting records the decision without touching the user', async () => {
      reportModel.findById.mockResolvedValue(makeReportDoc());
      const res = await service.reviewReport(
        'r1',
        adminId,
        ReportStatus.REJECTED,
        'Not a violation',
      );
      expect(res.suspended).toBe(false);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(
        notifications.sendReportApprovedNotification,
      ).not.toHaveBeenCalled();
    });

    it('approving increments the report count and notifies the user', async () => {
      reportModel.findById.mockResolvedValue(makeReportDoc());
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ reportCount: 2, status: UserStatus.ACTIVE }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ email: 'seller@test.com' }),
      });

      const res = await service.reviewReport(
        'r1',
        adminId,
        ReportStatus.APPROVED,
      );
      await flush();

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { reportCount: 1 } },
        { new: true },
      );
      expect(res.reportCount).toBe(2);
      expect(res.suspended).toBe(false);
      expect(notifications.sendReportApprovedNotification).toHaveBeenCalled();
      expect(email.sendReportApprovedEmail).toHaveBeenCalledWith(
        'seller@test.com',
        undefined,
      );
    });

    it('suspends the account on the 3rd upheld report', async () => {
      reportModel.findById.mockResolvedValue(makeReportDoc());
      // The approval that brings the count to exactly 3 triggers suspension.
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ reportCount: 3, status: UserStatus.ACTIVE }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ email: 'seller@test.com' }),
      });
      // Seller has one active listing to deactivate.
      listingModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([{ _id: new Types.ObjectId(listingId) }]),
      });

      const res = await service.reviewReport(
        'r1',
        adminId,
        ReportStatus.APPROVED,
      );
      await flush();

      expect(res.suspended).toBe(true);
      // Status + suspension window written.
      const suspendCall = userModel.findByIdAndUpdate.mock.calls.find(
        (c: any[]) => c[1]?.$set?.status === UserStatus.SUSPENDED,
      );
      expect(suspendCall).toBeTruthy();
      expect(suspendCall[1].$set.suspendedUntil).toBeInstanceOf(Date);
      expect(auth.invalidateAllSessions).toHaveBeenCalled();
      expect(listingModel.updateMany).toHaveBeenCalled();
      expect(searchSync.removeListing).toHaveBeenCalled();
      expect(
        notifications.sendAccountSuspendedUntilNotification,
      ).toHaveBeenCalled();
      expect(email.sendAccountSuspendedEmail).toHaveBeenCalled();
    });

    it('does not re-suspend a user already suspended', async () => {
      reportModel.findById.mockResolvedValue(makeReportDoc());
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ reportCount: 5, status: UserStatus.SUSPENDED }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ email: 'seller@test.com' }),
      });

      const res = await service.reviewReport(
        'r1',
        adminId,
        ReportStatus.APPROVED,
      );
      await flush();

      expect(res.suspended).toBe(false);
      expect(auth.invalidateAllSessions).not.toHaveBeenCalled();
    });

    it('throws when the report is already reviewed (idempotent)', async () => {
      reportModel.findById.mockResolvedValue(
        makeReportDoc({ status: ReportStatus.APPROVED }),
      );
      await expect(
        service.reviewReport('r1', adminId, ReportStatus.APPROVED),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for a missing report', async () => {
      reportModel.findById.mockResolvedValue(null);
      await expect(
        service.reviewReport('nope', adminId, ReportStatus.APPROVED),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects PENDING as a review decision', async () => {
      await expect(
        service.reviewReport('r1', adminId, ReportStatus.PENDING),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still resolves the review even if notification/email fails', async () => {
      reportModel.findById.mockResolvedValue(makeReportDoc());
      userModel.findByIdAndUpdate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ reportCount: 1, status: UserStatus.ACTIVE }),
      });
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ email: 'seller@test.com' }),
      });
      notifications.sendReportApprovedNotification.mockRejectedValue(
        new Error('push down'),
      );

      const res = await service.reviewReport(
        'r1',
        adminId,
        ReportStatus.APPROVED,
      );
      await flush();
      expect(res.reportCount).toBe(1); // decision unaffected by push failure
    });
  });

  // ── list ────────────────────────────────────────────────────

  describe('getAllReports', () => {
    it('returns paginated data with a total', async () => {
      reportModel.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ total: 3 }]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ _id: 'a' }, { _id: 'b' }]),
        });
      const res = await service.getAllReports({ page: 1, limit: 20 });
      expect(res.total).toBe(3);
      expect(res.data).toHaveLength(2);
      expect(res.page).toBe(1);
    });
  });
});
