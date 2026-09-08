import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/** Threshold in ms — requests slower than this are flagged */
const SLOW_REQUEST_THRESHOLD = 500;

/**
 * Log every request, not just the slow ones.
 *
 * Off by default because this interceptor is global: a line per request is a
 * synchronous write when stdout is a file or a pipe to a collector, which puts
 * disk I/O on the critical path of every response. Measured at 30-75% of
 * throughput on endpoints that are not database-bound, and 4x the p99 on a
 * cached endpoint (109ms -> 25ms once the write was removed).
 *
 * Enable with HTTP_LOG_ALL=true for local debugging or a short diagnostic
 * window in production.
 */
const LOG_ALL_REQUESTS = process.env.HTTP_LOG_ALL === 'true';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;

        // Nothing to report on a fast, successful request. Failures are already
        // logged by HttpExceptionFilter, so silence here does not lose them.
        if (duration <= SLOW_REQUEST_THRESHOLD && !LOG_ALL_REQUESTS) {
          return;
        }

        // Only assembled once we know the line will actually be emitted --
        // building it eagerly meant paying the string concatenation and the
        // `request.user` lookup on every request just to discard the result.
        const response = context.switchToHttp().getResponse();
        const userId = request.user?.sub || 'anonymous';
        const requestId = request.requestId || '-';
        const logEntry = `${method} ${url} ${response.statusCode} ${duration}ms [${requestId}] user=${userId}`;

        if (duration > SLOW_REQUEST_THRESHOLD) {
          this.logger.warn(`SLOW ${logEntry}`);
        } else {
          this.logger.log(logEntry);
        }
      }),
    );
  }
}
