import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Fields to strip from logged request bodies to avoid leaking secrets */
const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'otp',
  'secret',
  'cnic',
]);

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    // Extract public message and error code
    let message = 'Something went wrong. Please try again later.';
    let code: string | undefined;

    if (isHttpException && exceptionResponse) {
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || message;
        code = resp.code;
      }
    }

    const requestId = (request as any).requestId || '-';
    const userId = (request as any).user?.sub || 'anonymous';

    // Build public response
    const errorResponse: Record<string, any> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      requestId,
    };
    if (code) {
      errorResponse.code = code;
    }

    // Internal logging with full context (never sent to client)
    const logContext = {
      requestId,
      userId,
      method: request.method,
      path: request.url,
      statusCode: status,
      code,
      body: sanitizeBody(request.body),
      ip: request.ip || request.headers['x-forwarded-for'],
      userAgent: request.headers['user-agent'],
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} ${status}`,
        isHttpException
          ? (exception as any).stack
          : (exception as Error)?.stack,
        JSON.stringify(logContext),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${code || message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
