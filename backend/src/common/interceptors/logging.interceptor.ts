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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userId = request.user?.sub || 'anonymous';
    const requestId = (request as any).requestId || '-';
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const duration = Date.now() - now;

        const logEntry = `${method} ${url} ${statusCode} ${duration}ms [${requestId}] user=${userId}`;

        if (duration > SLOW_REQUEST_THRESHOLD) {
          this.logger.warn(`SLOW ${logEntry}`);
        } else {
          this.logger.log(logEntry);
        }
      }),
    );
  }
}
