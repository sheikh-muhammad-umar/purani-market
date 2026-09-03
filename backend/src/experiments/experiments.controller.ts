import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '../common/enums/user-role.enum.js';
import { ExperimentsService } from './experiments.service.js';
import { CreateExperimentDto } from './dto/create-experiment.dto.js';
import { TrackEventDto } from './dto/track-event.dto.js';

@Controller('api/experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  // ── Public: Get assignments for current user/visitor ──────────

  @Get('assignments')
  @UseGuards(OptionalJwtAuthGuard)
  async getAssignments(
    @CurrentUser('sub') userId: string | undefined,
    @Query('visitorId') visitorId: string | undefined,
  ) {
    const subjectId = userId || visitorId || 'anonymous';
    return this.experimentsService.getAssignments(subjectId);
  }

  // ── Public: Track experiment events ───────────────────────────

  @Post('track')
  @UseGuards(OptionalJwtAuthGuard)
  async trackEvent(
    @CurrentUser('sub') userId: string | undefined,
    @Body() dto: TrackEventDto,
  ) {
    const subjectId = userId || dto.visitorId || 'anonymous';
    await this.experimentsService.trackEvent(
      dto.experimentKey,
      dto.variantId,
      dto.eventType,
      subjectId,
      {
        searchQuery: dto.searchQuery,
        listingId: dto.listingId,
        position: dto.position,
        totalResults: dto.totalResults,
        metadata: dto.metadata,
      },
    );
    return { tracked: true };
  }

  // ── Admin: Manage experiments ─────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async listExperiments() {
    return this.experimentsService.listAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createExperiment(@Body() dto: CreateExperimentDto) {
    return this.experimentsService.create(dto);
  }

  @Patch(':key/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async startExperiment(@Param('key') key: string) {
    return this.experimentsService.start(key);
  }

  @Patch(':key/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async pauseExperiment(@Param('key') key: string) {
    return this.experimentsService.pause(key);
  }

  @Patch(':key/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async completeExperiment(@Param('key') key: string) {
    return this.experimentsService.complete(key);
  }

  @Get(':key/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getMetrics(
    @Param('key') key: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('controlVariantId') controlVariantId?: string,
  ) {
    return this.experimentsService.getMetrics(key, {
      dateFrom,
      dateTo,
      controlVariantId,
    });
  }
}
