import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CustomThrottlerGuard } from './guards/throttler.guard.js';
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
      /**
       * Throttling applies everywhere by default.
       *
       * It used to be opt-in per controller and only `AuthController` opted in,
       * so a new route was unthrottled unless its author remembered — and
       * search, every file upload and the tracking endpoint never were. Routes
       * wanting the strict tier ask with `@Throttle({ auth: {} })`.
       */
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
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

    /**
     * CSRF exclusions, named individually.
     *
     * The wildcards this replaces were far wider than the reason for them.
     * `api/auth/(.*)` was justified for the routes a caller reaches before they
     * have a session, but it also exempted logout, MFA enrolment and disabling,
     * and the email and phone change flows — exactly the routes CSRF protects.
     * `api/payments/(.*)` exempted an entire namespace to accommodate two
     * webhooks. Both now list the specific paths, matching how ApiKeyGuard
     * already names its two exceptions.
     *
     * The client attaches the token to every state-changing request to this API,
     * so the authenticated auth routes need no exemption to keep working.
     */
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        // Pre-session: the caller has no cookie to echo back yet.
        'api/auth/register',
        'api/auth/login',
        'api/auth/social-login',
        'api/auth/refresh-token',
        'api/auth/forgot-password',
        'api/auth/reset-password',
        'api/auth/verify-email',
        'api/auth/verify-phone',
        'api/auth/resend-verification',
        'api/auth/mfa/verify',
        // Reached from a link in an email inbox, with no session.
        'api/auth/change-email/verify',
        // External gateway POSTs, which cannot carry a cookie. Signature
        // verification is the control on these.
        'api/payments/stripe/webhook',
        'api/packages/payment-callback',
        // Analytics beacon. Sent from pages that may have no session; the impact
        // of a forged call is skewed analytics, not account change.
        'api/track',
      )
      .forRoutes('*');
  }
}
