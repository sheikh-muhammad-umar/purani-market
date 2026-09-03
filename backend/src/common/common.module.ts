import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { TransformInterceptor } from './interceptors/transform.interceptor.js';
import { LoggingInterceptor } from './interceptors/logging.interceptor.js';
import { AppValidationPipe } from './pipes/validation.pipe.js';
import { CsrfMiddleware } from './middleware/csrf.middleware.js';
import { RequestIdMiddleware } from './middleware/request-id.middleware.js';
import { CronLock, CronLockSchema } from './schemas/cron-lock.schema.js';
import { CronLockService } from './services/cron-lock.service.js';

// Global so the cluster-wide cron lock (CronLockService + its collection) is
// available to every feature module's scheduled jobs without re-importing.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CronLock.name, schema: CronLockSchema },
    ]),
  ],
  providers: [
    CronLockService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_PIPE,
      useValue: AppValidationPipe,
    },
  ],
  exports: [CronLockService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Request ID must run first — other middleware/interceptors depend on it
    consumer.apply(RequestIdMiddleware).forRoutes('*');

    consumer
      .apply(CsrfMiddleware)
      .exclude(
        'api/auth/(.*)', // login/register/verify flows (no cookie yet)
        'api/payments/(.*)', // external payment callbacks
        'api/packages/payment-callback', // payment gateway callbacks
        'api/track', // analytics tracking — protected by API key, no CSRF needed
      )
      .forRoutes('*');
  }
}
