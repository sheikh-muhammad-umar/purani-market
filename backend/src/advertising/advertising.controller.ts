import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdvertisingService, ServedAd } from './advertising.service.js';
import { RecordAdEventDto, ServeAdQueryDto } from './dto/serve-ad.dto.js';

/**
 * Public ad delivery.
 *
 * Deliberately unauthenticated: ads must render for anonymous visitors. The
 * routes are read-mostly and the only writes are impression and click counters,
 * which are scoped to a creative id that the caller had to be served first.
 */
@Controller('api/ads')
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  /** Returns the ads for one slot, or an empty list when the slot is unsold. */
  @Get('serve')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async serve(@Query() query: ServeAdQueryDto): Promise<{ ads: ServedAd[] }> {
    return { ads: await this.advertisingService.serve(query) };
  }

  /**
   * Records that a served creative was seen or clicked.
   *
   * Returns 202: the caller is reporting something that already happened and
   * must not be blocked or made to retry on our bookkeeping.
   */
  @Post(':creativeId/events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async recordEvent(
    @Param('creativeId') creativeId: string,
    @Body() dto: RecordAdEventDto,
    @Req() req: any,
  ): Promise<{ recorded: boolean }> {
    // Attributed to a user when one happens to be signed in, but never required.
    const userId = req?.user?.sub as string | undefined;
    return this.advertisingService.recordEvent(creativeId, dto, userId);
  }
}
