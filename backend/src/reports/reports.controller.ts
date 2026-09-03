import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, RolesGuard } from '../common/guards/index.js';
import { Roles, CurrentUser } from '../common/decorators/index.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ReviewReportDto } from './dto/review-report.dto.js';
import { ListReportsQueryDto } from './dto/list-reports-query.dto.js';
import { ReportStatus } from './schemas/report.schema.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { MAX_REPORT_SCREENSHOTS } from '../common/constants/index.js';
import { ERROR } from '../common/constants/error-messages.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_REGEX = /^image\/(jpeg|png|webp)$/;

@Controller('api/reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly tracker: AdminTrackerService,
  ) {}

  // ── User: file a report (with optional screenshots) ───────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('screenshots', MAX_REPORT_SCREENSHOTS, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_REGEX.test(file.mimetype)) {
          cb(new BadRequestException(ERROR.REPORT_INVALID_IMAGE_TYPE), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async createReport(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReportDto,
    @UploadedFiles() screenshots: Express.Multer.File[] = [],
    @Req() req: any,
  ) {
    const report = await this.reportsService.createReport(
      {
        reporterId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        message: dto.message,
        reason: dto.reason,
      },
      screenshots,
    );

    this.tracker.track(
      userId,
      UserAction.REPORT_SUBMIT,
      {
        reportId: report._id.toString(),
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
      req,
    );

    return report;
  }

  // ── Admin: queue, detail, review ──────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllReports(@Query() query: ListReportsQueryDto) {
    return this.reportsService.getAllReports({
      page: query.page,
      limit: query.limit,
      status: query.status,
      targetType: query.targetType,
      search: query.search,
    });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getReportDetail(@Param('id') id: string) {
    return this.reportsService.getReportById(id);
  }

  @Patch('admin/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reviewReport(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewReportDto,
    @Req() req: any,
  ) {
    const result = await this.reportsService.reviewReport(
      id,
      adminId,
      dto.status,
      dto.reviewNote,
    );

    this.tracker.track(
      adminId,
      dto.status === ReportStatus.APPROVED
        ? UserAction.ADMIN_REPORT_APPROVE
        : UserAction.ADMIN_REPORT_REJECT,
      {
        reportId: id,
        reportedUserId: result.report.reportedUserId.toString(),
        reportCount: result.reportCount,
        suspended: result.suspended,
      },
      req,
    );

    return result;
  }
}
