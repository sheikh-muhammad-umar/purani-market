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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, RolesGuard } from '../common/guards/index.js';
import { Roles, CurrentUser } from '../common/decorators/index.js';
import { UserRole } from '../users/schemas/user.schema.js';
import { IdVerificationService } from './id-verification.service.js';
import { ReviewVerificationDto } from './dto/review-verification.dto.js';
import { IdVerificationStatus } from './schemas/id-verification.schema.js';
import { AdminTrackerService } from '../ai/admin-tracker.service.js';
import { UserAction } from '../ai/schemas/user-activity.schema.js';
import { ERROR } from '../common/constants/error-messages.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_REGEX = /^image\/(jpeg|png)$/;

interface UploadedVerificationFiles {
  cnicFront?: Express.Multer.File[];
  cnicBack?: Express.Multer.File[];
  selfieFront?: Express.Multer.File[];
  selfieBack?: Express.Multer.File[];
}

@Controller('api/id-verification')
export class IdVerificationController {
  constructor(
    private readonly verificationService: IdVerificationService,
    private readonly tracker: AdminTrackerService,
  ) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cnicFront', maxCount: 1 },
        { name: 'cnicBack', maxCount: 1 },
        { name: 'selfieFront', maxCount: 1 },
        { name: 'selfieBack', maxCount: 1 },
      ],
      {
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (_req, file, cb) => {
          if (!ALLOWED_MIME_REGEX.test(file.mimetype)) {
            cb(
              new BadRequestException(ERROR.VERIFICATION_INVALID_IMAGE_TYPE),
              false,
            );
          } else {
            cb(null, true);
          }
        },
      },
    ),
  )
  async submitVerification(
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: UploadedVerificationFiles,
    @Req() req: any,
  ) {
    if (
      !files.cnicFront?.[0] ||
      !files.cnicBack?.[0] ||
      !files.selfieFront?.[0] ||
      !files.selfieBack?.[0]
    ) {
      throw new BadRequestException(ERROR.VERIFICATION_ALL_IMAGES_REQUIRED);
    }

    const result = await this.verificationService.submitVerification(userId, {
      cnicFront: files.cnicFront[0],
      cnicBack: files.cnicBack[0],
      selfieFront: files.selfieFront[0],
      selfieBack: files.selfieBack[0],
    });

    this.tracker.track(
      userId,
      UserAction.ID_VERIFICATION_SUBMIT,
      { verificationId: result._id.toString() },
      req,
    );

    return result;
  }

  @Get('my-status')
  @UseGuards(JwtAuthGuard)
  async getMyVerification(@CurrentUser('sub') userId: string) {
    const verification =
      await this.verificationService.getMyVerification(userId);
    return verification || { status: IdVerificationStatus.NONE };
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllVerifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.verificationService.getAllVerifications({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      search,
    });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getVerificationDetail(@Param('id') id: string) {
    return this.verificationService.getVerificationById(id);
  }

  @Patch('admin/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reviewVerification(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewVerificationDto,
    @Req() req: any,
  ) {
    const result = await this.verificationService.reviewVerification(
      id,
      adminId,
      dto.status,
      dto.rejectionReason,
    );

    const action =
      dto.status === IdVerificationStatus.APPROVED
        ? UserAction.ADMIN_ID_VERIFICATION_APPROVE
        : UserAction.ADMIN_ID_VERIFICATION_REJECT;

    this.tracker.track(
      adminId,
      action,
      {
        verificationId: id,
        userId: result.userId.toString(),
        ...(dto.rejectionReason
          ? { rejectionReason: dto.rejectionReason }
          : {}),
      },
      req,
    );

    return result;
  }
}
