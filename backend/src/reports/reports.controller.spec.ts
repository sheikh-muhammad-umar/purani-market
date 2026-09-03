import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { ReportStatus, ReportTargetType } from './schemas/report.schema.js';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: {
    createReport: jest.Mock;
    getAllReports: jest.Mock;
    getReportById: jest.Mock;
    reviewReport: jest.Mock;
  };
  let tracker: { track: jest.Mock };

  beforeEach(async () => {
    service = {
      createReport: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      getAllReports: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getReportById: jest.fn().mockResolvedValue({}),
      reviewReport: jest.fn().mockResolvedValue({
        report: { reportedUserId: new Types.ObjectId() },
        reportCount: 1,
        suspended: false,
      }),
    };
    tracker = { track: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: service },
        { provide: AdminTrackerService, useValue: tracker },
      ],
    }).compile();

    controller = module.get(ReportsController);
  });

  it('forwards a submitted report with the reporter id and screenshots', async () => {
    const dto = {
      targetType: ReportTargetType.USER,
      targetId: new Types.ObjectId().toString(),
      message: 'x'.repeat(10),
    } as any;
    const files = [{ originalname: 'a.png', buffer: Buffer.from('x') }] as any;

    await controller.createReport('user-1', dto, files, {});

    expect(service.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporterId: 'user-1', targetId: dto.targetId }),
      files,
    );
    expect(tracker.track).toHaveBeenCalledWith(
      'user-1',
      UserAction.REPORT_SUBMIT,
      expect.any(Object),
      expect.anything(),
    );
  });

  it('defaults screenshots to an empty array when none are uploaded', async () => {
    const dto = {
      targetType: ReportTargetType.USER,
      targetId: new Types.ObjectId().toString(),
      message: 'x'.repeat(10),
    } as any;
    await controller.createReport('user-1', dto, undefined as any, {});
    expect(service.createReport).toHaveBeenCalledWith(expect.any(Object), []);
  });

  it('lists reports via the query dto', async () => {
    await controller.getAllReports({
      page: 2,
      limit: 10,
      status: ReportStatus.PENDING,
    } as any);
    expect(service.getAllReports).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: ReportStatus.PENDING,
      }),
    );
  });

  it('tracks ADMIN_REPORT_APPROVE when approving', async () => {
    await controller.reviewReport(
      'r1',
      'admin-1',
      { status: ReportStatus.APPROVED } as any,
      {},
    );
    expect(service.reviewReport).toHaveBeenCalledWith(
      'r1',
      'admin-1',
      ReportStatus.APPROVED,
      undefined,
    );
    expect(tracker.track).toHaveBeenCalledWith(
      'admin-1',
      UserAction.ADMIN_REPORT_APPROVE,
      expect.any(Object),
      expect.anything(),
    );
  });

  it('tracks ADMIN_REPORT_REJECT when rejecting', async () => {
    await controller.reviewReport(
      'r1',
      'admin-1',
      { status: ReportStatus.REJECTED, reviewNote: 'nope' } as any,
      {},
    );
    expect(tracker.track).toHaveBeenCalledWith(
      'admin-1',
      UserAction.ADMIN_REPORT_REJECT,
      expect.any(Object),
      expect.anything(),
    );
  });
});
