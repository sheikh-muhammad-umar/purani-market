import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = '_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * CSRF double-submit cookie middleware.
 *
 * Production (same-origin): the _csrf cookie is set with sameSite=strict.
 * The frontend reads it via document.cookie and echoes it in the
 * X-CSRF-Token header. The middleware compares cookie vs header.
 *
 * Development (cross-origin, e.g. localhost:4200 → localhost:3000):
 * sameSite cookies don't work across different ports over plain HTTP.
 * CORS origin restrictions already prevent unwanted cross-origin requests,
 * so CSRF validation is skipped in non-production environments.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Issue a CSRF token cookie if not present
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // client JS needs to read it
        sameSite: IS_PRODUCTION ? 'strict' : 'lax',
        secure: IS_PRODUCTION,
      });
      // Expose the token as a response header so the frontend can capture it
      res.setHeader(CSRF_TOKEN_HEADER, token);
    } else {
      // Always echo the current token so the frontend can pick it up
      res.setHeader(CSRF_TOKEN_HEADER, req.cookies[CSRF_COOKIE_NAME]);
    }

    // Safe methods don't need CSRF validation
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // In non-production, CORS origin restrictions handle cross-origin safety.
    // Cookie-based CSRF doesn't work cross-origin over HTTP (different ports).
    if (!IS_PRODUCTION) {
      next();
      return;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_TOKEN_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    next();
  }
}
