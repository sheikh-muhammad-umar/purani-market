import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
export declare class CustomThrottlerGuard extends NestThrottlerGuard {
    protected throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void>;
}
