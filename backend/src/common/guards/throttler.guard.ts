import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard as NestThrottlerGuard,
  ThrottlerException,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends NestThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = this.getRequestResponse(context).res;
    const retryAfterSeconds = Math.ceil(throttlerLimitDetail.timeToExpire / 1000);
    res.header('Retry-After', String(retryAfterSeconds));

    throw new ThrottlerException(
      `Too Many Requests. Please retry after ${retryAfterSeconds} seconds.`,
    );
  }
}
